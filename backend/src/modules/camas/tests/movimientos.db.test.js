// Alta y traslado contra la base real (HU 2.1). Igual que concurrencia.db.test.js:
// solo corre con DB_TESTS=1 y borra lo que crea.
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

const test = require('node:test');
const assert = require('node:assert/strict');

const activo = process.env.DB_TESTS === '1';

test('alta por evento, limpieza y traslado', { skip: !activo }, async (t) => {
  const pool = require('../../../shared/db/pool');
  const eventBus = require('../../../shared/events/eventBus');
  const eventos = require('../../../shared/events/eventos');
  const eventosCamas = require('../dominio/eventos');
  const { registrarSuscriptores } = require('../suscriptores');
  const camas = require('../servicio/camasServicio');
  const movimientos = require('../servicio/movimientosServicio');
  registrarSuscriptores();

  const marca = `TC${Date.now()}`.slice(-14);
  const { rows: [paciente] } = await pool.query(
    `INSERT INTO pacientes (nombre, apellido, documento) VALUES ('Test', 'Traslado', $1) RETURNING id`,
    [`TEST-CAMAS-${marca}`]
  );
  const hab = await camas.crearHabitacion({ numero: marca, piso: 9, tipo: 'compartida', capacidad: 2 });
  const a = await camas.crearCama({ codigo: `${marca}-A`, habitacionId: hab.id });
  const b = await camas.crearCama({ codigo: `${marca}-B`, habitacionId: hab.id });

  t.after(async () => {
    await pool.query('DELETE FROM asignaciones_cama WHERE cama_id = ANY($1::int[])', [[a.id, b.id]]);
    await pool.query('DELETE FROM camas WHERE habitacion_id = $1', [hab.id]);
    await pool.query('DELETE FROM habitaciones WHERE id = $1', [hab.id]);
    await pool.query('DELETE FROM pacientes WHERE id = $1', [paciente.id]);
    await pool.end();
  });

  const recibidos = [];
  for (const nombre of Object.values(eventosCamas)) {
    eventBus.on(nombre, (carga) => recibidos.push({ nombre, carga }));
  }

  // Traslado de A a B: A queda en limpieza, B ocupada, una sola asignacion vigente.
  await camas.asignar(a.id, { pacienteId: paciente.id });
  await movimientos.trasladar(paciente.id, { camaDestinoId: b.id });
  assert.equal((await camas.detalle(a.id)).estado, 'en_limpieza');
  const destino = await camas.detalle(b.id);
  assert.equal(destino.estado, 'ocupada');
  assert.equal(destino.paciente_id, paciente.id);
  assert.ok(recibidos.some((e) => e.nombre === eventosCamas.PACIENTE_TRASLADADO));

  // Un traslado a una cama en limpieza falla y no deja nada a medias.
  await assert.rejects(movimientos.trasladar(paciente.id, { camaDestinoId: a.id }), { code: 'TRANSICION_INVALIDA' });
  assert.equal((await camas.detalle(b.id)).estado, 'ocupada');

  // Alta: el evento de Atencion pasa la cama a limpieza.
  eventBus.emit(eventos.PACIENTE_DADO_DE_ALTA, { pacienteId: paciente.id, camaId: b.id });
  await new Promise((r) => setTimeout(r, 200));
  assert.equal((await camas.detalle(b.id)).estado, 'en_limpieza');
  const liberada = recibidos.filter((e) => e.nombre === eventosCamas.CAMA_LIBERADA).at(-1);
  assert.equal(liberada.carga.motivoEgreso, 'alta');
  assert.equal(liberada.carga.dias, 1);

  // En limpieza no se puede asignar; maestranza la deja disponible.
  await assert.rejects(camas.asignar(b.id, { pacienteId: paciente.id }), { code: 'TRANSICION_INVALIDA' });
  await movimientos.finalizarLimpieza(b.id);
  assert.equal((await camas.detalle(b.id)).estado, 'disponible');
});
