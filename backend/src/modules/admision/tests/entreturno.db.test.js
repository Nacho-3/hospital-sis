// HU 1.2 contra la base real.
// No corre por defecto porque necesita PostgreSQL con el esquema aplicado.
// Para correrlo, desde backend/:
//   PowerShell:  $env:DB_TESTS="1"; node --test src/modules/admision/tests/entreturno.db.test.js
// Crea sus propios datos (prefijo TEST-ENTRETURNO) y los borra al terminar.
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

const test = require('node:test');
const assert = require('node:assert/strict');

const activo = process.env.DB_TESTS === '1';
const MEDIA_HORA_MS = 30 * 60 * 1000;
const CUARTO_MS = 15 * 60 * 1000;

test('parte un turno programado de 30 minutos y rechaza partirlo de nuevo', { skip: !activo }, async (t) => {
  const pool = require('../../../shared/db/pool');
  const admision = require('../servicio/admisionServicio');
  const marca = `TEST-ENTRETURNO-${Date.now()}`;

  const { rows: medicos } = await pool.query(
    `INSERT INTO usuarios (email, password_hash, nombre, apellido)
     VALUES ($1, 'test', 'Silva', 'Test')
     RETURNING id`,
    [`${marca}@test`]
  );
  const medicoId = medicos[0].id;
  const { rows: pacientes } = await pool.query(
    `INSERT INTO pacientes (nombre, apellido, documento)
     VALUES ('Carlos', 'López', $1)
     RETURNING id`,
    [`${marca}-1`]
  );
  const inicio = new Date(Date.now() + 48 * 60 * 60 * 1000);
  inicio.setMinutes(0, 0, 0);
  const fin = new Date(inicio.getTime() + MEDIA_HORA_MS);
  const turno = await admision.abrirTurno({
    medicoId,
    inicio: inicio.toISOString(),
    fin: fin.toISOString(),
  });
  await admision.reservar(turno.id, { pacienteId: pacientes[0].id });

  const libre = await admision.abrirTurno({
    medicoId,
    inicio: new Date(inicio.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    fin: new Date(inicio.getTime() + 2 * 60 * 60 * 1000 + MEDIA_HORA_MS).toISOString(),
  });

  t.after(async () => {
    await pool.query('DELETE FROM turnos WHERE medico_id = $1', [medicoId]);
    await pool.query('DELETE FROM pacientes WHERE id = $1', [pacientes[0].id]);
    await pool.query('DELETE FROM usuarios WHERE id = $1', [medicoId]);
    await pool.end();
  });

  const resultado = await admision.insertarEntreturno(turno.id);
  const achicado = resultado.turno;
  const entreturno = resultado.entreturno;

  assert.equal(achicado.estado, 'programado');
  assert.equal(achicado.paciente_id, pacientes[0].id);
  assert.equal(achicado.duracion_reducida, true);
  assert.equal(achicado.es_entreturno, false);
  assert.equal(new Date(achicado.fin).getTime() - new Date(achicado.inicio).getTime(), CUARTO_MS);

  assert.equal(entreturno.estado, 'disponible');
  assert.equal(entreturno.paciente_id, null);
  assert.equal(entreturno.es_entreturno, true);
  assert.equal(entreturno.duracion_reducida, false);
  assert.equal(new Date(entreturno.inicio).getTime(), new Date(achicado.fin).getTime());
  assert.equal(new Date(entreturno.fin).getTime(), fin.getTime());

  await assert.rejects(
    () => admision.insertarEntreturno(achicado.id),
    (err) => err.status === 400 && /30 minutos/.test(err.message)
  );

  const carrera = await Promise.allSettled([
    admision.insertarEntreturno(libre.id),
    admision.insertarEntreturno(libre.id),
  ]);
  const ok = carrera.filter((r) => r.status === 'fulfilled');
  const fallidos = carrera.filter((r) => r.status === 'rejected');
  assert.equal(ok.length, 1);
  assert.equal(fallidos.length, 1);
  assert.equal(fallidos[0].reason.status, 400);

  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM turnos
      WHERE medico_id = $1 AND es_entreturno`,
    [medicoId]
  );
  assert.equal(rows[0].n, 2);
});
