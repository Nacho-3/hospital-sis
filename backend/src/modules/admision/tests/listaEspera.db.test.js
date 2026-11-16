// HU 1.3 contra la base real.
// No corre por defecto porque necesita PostgreSQL con el esquema aplicado.
// Para correrlo, desde backend/:
//   PowerShell:  $env:DB_TESTS="1"; node --test src/modules/admision/tests/listaEspera.db.test.js
// Crea sus propios datos (prefijo TEST-ESPERA) y los borra al terminar.
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

const test = require('node:test');
const assert = require('node:assert/strict');

const activo = process.env.DB_TESTS === '1';
const MEDIA_HORA_MS = 30 * 60 * 1000;

test('al cancelar, el primero de la lista se queda con ese horario', { skip: !activo }, async (t) => {
  const pool = require('../../../shared/db/pool');
  const admision = require('../servicio/admisionServicio');
  const marca = `TEST-ESPERA-${Date.now()}`;
  let medicoId;

  t.after(async () => {
    if (medicoId) {
      await pool.query('DELETE FROM lista_espera WHERE medico_id = $1', [medicoId]);
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
     VALUES ('Carlos', 'López', $1), ('Luis', 'Medina', $2), ('Ana', 'Rojas', $3)
     RETURNING id, apellido`,
    [`${marca}-1`, `${marca}-2`, `${marca}-3`]
  );
  const carlos = pacientes.find((p) => p.apellido === 'López');
  const luis = pacientes.find((p) => p.apellido === 'Medina');
  const ana = pacientes.find((p) => p.apellido === 'Rojas');

  const inicio = new Date('2026-12-01T14:00:00.000Z');
  const fin = new Date(inicio.getTime() + MEDIA_HORA_MS);
  const turno = await admision.abrirTurno({
    medicoId,
    inicio: inicio.toISOString(),
    fin: fin.toISOString(),
  });
  await admision.reservar(turno.id, { pacienteId: carlos.id });
  const primero = await admision.anotarEnEspera({
    pacienteId: luis.id,
    medicoId,
    fecha: '2026-12-01',
  });
  const segundo = await admision.anotarEnEspera({
    pacienteId: ana.id,
    medicoId,
    fecha: '2026-12-01',
  });
  assert.equal(primero.posicion, 1);
  assert.equal(segundo.posicion, 2);

  await assert.rejects(
    () => admision.anotarEnEspera({ pacienteId: luis.id, medicoId, fecha: '2026-12-01' }),
    (err) => err.status === 400 && /ya está en la lista/.test(err.message)
  );

  const resultado = await admision.cancelar(turno.id);
  assert.equal(resultado.turno.estado, 'cancelado');
  assert.equal(resultado.turno.paciente_id, carlos.id);
  assert.equal(resultado.asignado.turno.estado, 'programado');
  assert.equal(resultado.asignado.turno.paciente_id, luis.id);
  assert.equal(new Date(resultado.asignado.turno.inicio).getTime(), inicio.getTime());
  assert.equal(new Date(resultado.asignado.turno.fin).getTime(), fin.getTime());
  assert.match(resultado.asignado.aviso, /Llamá a Medina, Luis/);

  const { rows: cola } = await pool.query(
    `SELECT paciente_id, estado, turno_id, posicion
       FROM lista_espera
      WHERE medico_id = $1
      ORDER BY posicion`,
    [medicoId]
  );
  assert.equal(cola[0].estado, 'asignado');
  assert.equal(cola[0].turno_id, resultado.asignado.turno.id);
  assert.equal(cola[1].estado, 'en_espera');
  assert.equal(cola[1].paciente_id, ana.id);

  const otro = await admision.abrirTurno({
    medicoId,
    inicio: new Date(inicio.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    fin: new Date(inicio.getTime() + 2 * 60 * 60 * 1000 + MEDIA_HORA_MS).toISOString(),
  });
  const libre = await admision.abrirTurno({
    medicoId,
    inicio: new Date(inicio.getTime() + 3 * 60 * 60 * 1000).toISOString(),
    fin: new Date(inicio.getTime() + 3 * 60 * 60 * 1000 + MEDIA_HORA_MS).toISOString(),
  });
  await admision.reservar(otro.id, { pacienteId: carlos.id });
  await admision.reservar(libre.id, { pacienteId: carlos.id });

  const carrera = await Promise.allSettled([
    admision.cancelar(otro.id),
    admision.cancelar(libre.id),
  ]);
  assert.equal(carrera.filter((r) => r.status === 'fulfilled').length, 2);
  const conAviso = carrera.filter((r) => r.value.asignado);
  const sinAviso = carrera.filter((r) => !r.value.asignado);
  assert.equal(conAviso.length, 1);
  assert.equal(sinAviso.length, 1);
  assert.equal(conAviso[0].value.asignado.turno.paciente_id, ana.id);
});
