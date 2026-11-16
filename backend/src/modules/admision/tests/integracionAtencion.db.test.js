// Admisión publica y Atención reacciona, en el mismo proceso.
//   PowerShell:  $env:DB_TESTS="1"; node --test src/modules/admision/tests/integracionAtencion.db.test.js
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

const test = require('node:test');
const assert = require('node:assert/strict');

const activo = process.env.DB_TESTS === '1';

function esperar(ms) {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

async function hasta(leer, ms = 2000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    const valor = await leer();
    if (valor) return valor;
    await esperar(40);
  }
  return null;
}

test('atencion recibe el codigo rojo, la llegada y el protocolo de ingreso', { skip: !activo }, async (t) => {
  const pool = require('../../../shared/db/pool');
  require('../../atencion/rutas');
  const admision = require('../servicio/admisionServicio');
  const avisos = require('../../atencion/servicio/avisosService');
  const protocolos = require('../../atencion/servicio/protocoloService');

  const marca = `TEST-INTEG-${Date.now()}`;
  const pacientesIds = [];
  let enfermeroId;
  let medicoId;
  let turnoId;

  t.after(async () => {
    if (pacientesIds.length) {
      await pool.query(
        `DELETE FROM protocolo_tareas
          WHERE protocolo_id IN (SELECT id FROM protocolos WHERE paciente_id = ANY($1::int[]))`,
        [pacientesIds]
      );
      await pool.query('DELETE FROM protocolos WHERE paciente_id = ANY($1::int[])', [pacientesIds]);
      await pool.query('DELETE FROM avisos_clinicos WHERE paciente_id = ANY($1::int[])', [pacientesIds]);
      await pool.query('DELETE FROM ingresos_observacion WHERE paciente_id = ANY($1::int[])', [pacientesIds]);
      await pool.query('DELETE FROM cola_guardia WHERE paciente_id = ANY($1::int[])', [pacientesIds]);
      await pool.query('DELETE FROM turnos WHERE paciente_id = ANY($1::int[]) OR id = $2', [pacientesIds, turnoId || 0]);
      await pool.query('DELETE FROM pacientes WHERE id = ANY($1::int[])', [pacientesIds]);
    }
    const usuarios = [enfermeroId, medicoId].filter(Boolean);
    if (usuarios.length) {
      await pool.query('DELETE FROM usuario_rol WHERE usuario_id = ANY($1::int[])', [usuarios]);
      await pool.query('DELETE FROM usuarios WHERE id = ANY($1::int[])', [usuarios]);
    }
    await pool.end();
  });

  const { rows: enfermeros } = await pool.query(
    `INSERT INTO usuarios (email, password_hash, nombre, apellido)
     VALUES ($1, 'test', 'Nora', 'Ríos') RETURNING id`,
    [`enfermero-${marca}@test`]
  );
  enfermeroId = enfermeros[0].id;
  await pool.query(
    `INSERT INTO usuario_rol (usuario_id, rol_id)
     SELECT $1, id FROM roles WHERE codigo = 'ENFERMERO'`,
    [enfermeroId]
  );
  const { rows: medicos } = await pool.query(
    `INSERT INTO usuarios (email, password_hash, nombre, apellido)
     VALUES ($1, 'test', 'Iván', 'Sosa') RETURNING id`,
    [`medico-${marca}@test`]
  );
  medicoId = medicos[0].id;
  await pool.query(
    `INSERT INTO usuario_rol (usuario_id, rol_id)
     SELECT $1, id FROM roles WHERE codigo = 'MEDICO'`,
    [medicoId]
  );
  const { rows: pacientes } = await pool.query(
    `INSERT INTO pacientes (nombre, apellido, documento)
     VALUES ('Ana', 'Paz', $1), ('Luis', 'Quirós', $2)
     RETURNING id, apellido`,
    [`${marca}-1`, `${marca}-2`]
  );
  pacientesIds.push(...pacientes.map((p) => p.id));
  const porApellido = (apellido) => pacientes.find((p) => p.apellido === apellido).id;

  await admision.clasificarGuardia({
    pacienteId: porApellido('Paz'),
    enfermeroId,
    nivel: 'amarillo',
  });
  const sinRojo = (await avisos.listarAbiertos())
    .filter((fila) => pacientesIds.includes(fila.paciente_id));
  assert.equal(sinRojo.length, 0);

  await admision.clasificarGuardia({
    pacienteId: porApellido('Quirós'),
    enfermeroId,
    nivel: 'rojo',
  });
  const rojo = await hasta(async () => {
    const filas = (await avisos.listarAbiertos())
      .filter((fila) => fila.paciente_id === porApellido('Quirós') && fila.tipo === 'codigo_rojo');
    return filas[0];
  });
  assert.ok(rojo, 'Atención no anotó el código rojo');
  assert.equal(await protocolos.listarPorPaciente(porApellido('Quirós')).then((lista) => lista.length), 0);

  const turno = await admision.abrirTurno({
    medicoId,
    inicio: '2099-06-02T13:00:00.000Z',
    fin: '2099-06-02T13:30:00.000Z',
  });
  turnoId = turno.id;
  await admision.reservar(turnoId, { pacienteId: porApellido('Paz') });
  await admision.confirmar(turnoId);
  await admision.registrarLlegada(turnoId);
  const mostrador = await hasta(async () => {
    const filas = (await avisos.listarAbiertos())
      .filter((fila) => fila.turno_id === turnoId && fila.tipo === 'mostrador');
    return filas[0];
  });
  assert.ok(mostrador, 'Atención no anotó la llegada al mostrador');
  assert.equal(mostrador.paciente_id, porApellido('Paz'));
  assert.equal(mostrador.medico_id, medicoId);

  await admision.ingresarObservacion({
    pacienteId: porApellido('Paz'),
    tipoIngreso: 'pre_quirurgico',
  });
  const preop = await hasta(() => protocolos.listarPorPaciente(porApellido('Paz'))
    .then((lista) => lista.find((item) => item.tipo === 'pre_quirurgico')));
  assert.ok(preop, 'Atención no armó el protocolo prequirúrgico');
  assert.equal(preop.tareas.length, 3);

  await assert.rejects(
    () => admision.ingresarObservacion({
      pacienteId: porApellido('Paz'),
      tipoIngreso: 'pre_quirurgico',
    }),
    (err) => err.status === 400 && /ya fue confirmado/.test(err.message)
  );

  await admision.ingresarObservacion({
    pacienteId: porApellido('Paz'),
    tipoIngreso: 'infeccion_respiratoria',
  });
  const respiratorio = await hasta(() => protocolos.listarPorPaciente(porApellido('Paz'))
    .then((lista) => lista.find((item) => item.tipo === 'infeccion_respiratoria')));
  assert.ok(respiratorio, 'Atención no armó el protocolo respiratorio');
  assert.equal(respiratorio.tareas.length, 2);
});
