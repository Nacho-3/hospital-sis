// Test de concurrencia contra la base real (HU 1.1 escenario 2).
// No corre por defecto porque necesita PostgreSQL con el esquema aplicado.
// Para correrlo, desde backend/:
//   PowerShell:  $env:DB_TESTS="1"; node --test src/modules/admision/tests/concurrencia.db.test.js
// Crea sus propios datos (prefijo TEST-ADMISION) y los borra al terminar.
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

const test = require('node:test');
const assert = require('node:assert/strict');

const activo = process.env.DB_TESTS === '1';

test('dos reservas simultaneas del mismo turno: una pasa y la otra recibe 409', { skip: !activo }, async (t) => {
  const pool = require('../../../shared/db/pool');
  const admision = require('../servicio/admisionServicio');
  const marca = `TEST-ADMISION-${Date.now()}`;

  const { rows: medicos } = await pool.query(
    `INSERT INTO usuarios (email, password_hash, nombre, apellido)
     VALUES ($1, 'test', 'Silva', 'Test')
     RETURNING id`,
    [`${marca}@test`]
  );
  const medicoId = medicos[0].id;
  const { rows: pacientes } = await pool.query(
    `INSERT INTO pacientes (nombre, apellido, documento)
     VALUES ('Carlos', 'López', $1), ('Ana', 'Rojas', $2)
     RETURNING id`,
    [`${marca}-1`, `${marca}-2`]
  );
  const inicio = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const fin = new Date(inicio.getTime() + 30 * 60 * 1000);
  const turno = await admision.abrirTurno({
    medicoId,
    inicio: inicio.toISOString(),
    fin: fin.toISOString(),
  });

  t.after(async () => {
    await pool.query('DELETE FROM turnos WHERE id = $1', [turno.id]);
    await pool.query('DELETE FROM pacientes WHERE id = ANY($1::int[])', [pacientes.map((p) => p.id)]);
    await pool.query('DELETE FROM usuarios WHERE id = $1', [medicoId]);
    await pool.end();
  });

  const resultados = await Promise.allSettled([
    admision.reservar(turno.id, { pacienteId: pacientes[0].id }),
    admision.reservar(turno.id, { pacienteId: pacientes[1].id }),
  ]);

  const ok = resultados.filter((r) => r.status === 'fulfilled');
  const fallidos = resultados.filter((r) => r.status === 'rejected');
  assert.equal(ok.length, 1, 'exactamente una reserva tiene que pasar');
  assert.equal(fallidos.length, 1);
  assert.equal(fallidos[0].reason.status, 409);
  assert.equal(fallidos[0].reason.code, 'CONFLICTO_DE_CONCURRENCIA');
  assert.match(fallidos[0].reason.message, /acaba de ser ocupado/);

  const { rows } = await pool.query('SELECT estado, paciente_id FROM turnos WHERE id = $1', [turno.id]);
  assert.equal(rows[0].estado, 'programado');
  assert.ok(pacientes.some((p) => p.id === rows[0].paciente_id));
});
