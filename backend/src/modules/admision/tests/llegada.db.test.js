// HU 2.1 contra la base real: la llegada publica el evento despues de guardar,
// y un turno cancelado no pasa a atendido.
//   PowerShell:  $env:DB_TESTS="1"; node --test src/modules/admision/tests/llegada.db.test.js
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

const test = require('node:test');
const assert = require('node:assert/strict');

const activo = process.env.DB_TESTS === '1';

test('llegar al mostrador avisa y un cancelado no queda atendido', { skip: !activo }, async (t) => {
  const pool = require('../../../shared/db/pool');
  const eventBus = require('../../../shared/events/eventBus');
  const EVENTOS = require('../../../shared/events/eventos');
  const admision = require('../servicio/admisionServicio');
  const marca = `TEST-SALA-${Date.now()}`;
  const avisos = [];
  const escuchar = (carga) => avisos.push(carga);
  let medicoId;

  eventBus.on(EVENTOS.TURNO_EN_SALA_DE_ESPERA, escuchar);

  t.after(async () => {
    eventBus.off(EVENTOS.TURNO_EN_SALA_DE_ESPERA, escuchar);
    if (medicoId) {
      await pool.query('DELETE FROM turnos WHERE medico_id = $1', [medicoId]);
      await pool.query('DELETE FROM usuario_rol WHERE usuario_id = $1', [medicoId]);
      await pool.query('DELETE FROM pacientes WHERE documento LIKE $1', [`${marca}%`]);
      await pool.query('DELETE FROM usuarios WHERE id = $1', [medicoId]);
    }
    await pool.end();
  });

  const { rows: medicos } = await pool.query(
    `INSERT INTO usuarios (email, password_hash, nombre, apellido)
     VALUES ($1, 'test', 'Andrés', 'Silva')
     RETURNING id`,
    [`${marca}@test`]
  );
  medicoId = medicos[0].id;
  await pool.query(
    `INSERT INTO usuario_rol (usuario_id, rol_id)
     SELECT $1, id FROM roles WHERE codigo = 'MEDICO'`,
    [medicoId]
  );
  const { rows: pacientes } = await pool.query(
    `INSERT INTO pacientes (nombre, apellido, documento)
     VALUES ('Carlos', 'López', $1)
     RETURNING id`,
    [`${marca}-1`]
  );
  const inicio = new Date('2026-12-02T14:00:00.000Z');
  const fin = new Date(inicio.getTime() + 30 * 60 * 1000);
  const abierto = await admision.abrirTurno({
    medicoId,
    inicio: inicio.toISOString(),
    fin: fin.toISOString(),
  });
  await admision.reservar(abierto.id, { pacienteId: pacientes[0].id });
  await admision.confirmar(abierto.id);

  const enSala = await admision.registrarLlegada(abierto.id);
  assert.equal(enSala.estado, 'en_sala_de_espera');
  assert.equal(avisos.length, 1);
  assert.deepEqual(avisos[0], {
    turnoId: abierto.id,
    pacienteId: pacientes[0].id,
    medicoId,
  });

  const otro = await admision.abrirTurno({
    medicoId,
    inicio: new Date(inicio.getTime() + 60 * 60 * 1000).toISOString(),
    fin: new Date(inicio.getTime() + 90 * 60 * 1000).toISOString(),
  });
  await admision.reservar(otro.id, { pacienteId: pacientes[0].id });
  await admision.cancelar(otro.id);
  await assert.rejects(
    () => admision.atender(otro.id),
    (err) => err.status === 422 && /no puede pasar a atendido/.test(err.message)
  );
  const { rows } = await pool.query('SELECT estado FROM turnos WHERE id = $1', [otro.id]);
  assert.equal(rows[0].estado, 'cancelado');
});
