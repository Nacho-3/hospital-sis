// Test de concurrencia contra la base real (HU 1.1 escenario 2).
// No corre por defecto porque necesita PostgreSQL con el esquema aplicado.
// Para correrlo, desde backend/:
//   PowerShell:  $env:DB_TESTS="1"; npm test
//   bash:        DB_TESTS=1 npm test
// Crea sus propios datos (prefijo TEST-CAMAS) y los borra al terminar.
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

const test = require('node:test');
const assert = require('node:assert/strict');

const activo = process.env.DB_TESTS === '1';

test('dos asignaciones simultaneas a la misma cama: una pasa y la otra recibe 409', { skip: !activo }, async (t) => {
  const pool = require('../../../shared/db/pool');
  const camas = require('../servicio/camasServicio');
  const marca = `TEST-CAMAS-${Date.now()}`;

  const { rows: pacientes } = await pool.query(
    `INSERT INTO pacientes (nombre, apellido, documento)
     VALUES ('Laura', 'Gómez', $1), ('Otro', 'Paciente', $2)
     RETURNING id`,
    [`${marca}-1`, `${marca}-2`]
  );
  const habitacion = await camas.crearHabitacion({ numero: marca.slice(-20), piso: 9, tipo: 'compartida', capacidad: 2 });
  const cama = await camas.crearCama({ codigo: marca.slice(-20), habitacionId: habitacion.id });

  t.after(async () => {
    await pool.query('DELETE FROM asignaciones_cama WHERE cama_id = $1', [cama.id]);
    await pool.query('DELETE FROM camas WHERE id = $1', [cama.id]);
    await pool.query('DELETE FROM habitaciones WHERE id = $1', [habitacion.id]);
    await pool.query('DELETE FROM pacientes WHERE id = ANY($1::int[])', [pacientes.map((p) => p.id)]);
    await pool.end();
  });

  const resultados = await Promise.allSettled([
    camas.asignar(cama.id, { pacienteId: pacientes[0].id }),
    camas.asignar(cama.id, { pacienteId: pacientes[1].id }),
  ]);

  const ok = resultados.filter((r) => r.status === 'fulfilled');
  const fallidos = resultados.filter((r) => r.status === 'rejected');
  assert.equal(ok.length, 1, 'exactamente una asignacion tiene que pasar');
  assert.equal(fallidos.length, 1);
  assert.equal(fallidos[0].reason.status, 409);
  assert.equal(fallidos[0].reason.code, 'CONFLICTO_DE_CONCURRENCIA');
  assert.match(fallidos[0].reason.message, /acaba de ser ocupada/);

  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS n FROM asignaciones_cama WHERE cama_id = $1 AND fecha_hora_egreso IS NULL',
    [cama.id]
  );
  assert.equal(rows[0].n, 1);
  assert.equal((await camas.detalle(cama.id)).estado, 'ocupada');
});
