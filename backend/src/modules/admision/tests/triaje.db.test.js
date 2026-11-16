// HU 3.1 contra la base real.
//   PowerShell:  $env:DB_TESTS="1"; node --test src/modules/admision/tests/triaje.db.test.js
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

const test = require('node:test');
const assert = require('node:assert/strict');

const activo = process.env.DB_TESTS === '1';

test('un codigo rojo entra delante de los de menor riesgo y avisa', { skip: !activo }, async (t) => {
  const pool = require('../../../shared/db/pool');
  const eventBus = require('../../../shared/events/eventBus');
  const EVENTOS = require('../../../shared/events/eventos');
  const admision = require('../servicio/admisionServicio');
  const marca = `TEST-TRIAJE-${Date.now()}`;
  const avisos = [];
  const escuchar = (carga) => avisos.push(carga);
  let enfermeroId;
  const pacientesIds = [];

  eventBus.on(EVENTOS.TRIAJE_RIESGO_VITAL, escuchar);

  t.after(async () => {
    eventBus.off(EVENTOS.TRIAJE_RIESGO_VITAL, escuchar);
    if (pacientesIds.length) {
      await pool.query('DELETE FROM cola_guardia WHERE paciente_id = ANY($1::int[])', [pacientesIds]);
      await pool.query('DELETE FROM pacientes WHERE id = ANY($1::int[])', [pacientesIds]);
    }
    if (enfermeroId) {
      await pool.query('DELETE FROM usuario_rol WHERE usuario_id = $1', [enfermeroId]);
      await pool.query('DELETE FROM usuarios WHERE id = $1', [enfermeroId]);
    }
    await pool.end();
  });

  const { rows: enfermeros } = await pool.query(
    `INSERT INTO usuarios (email, password_hash, nombre, apellido)
     VALUES ($1, 'test', 'Laura', 'Gómez')
     RETURNING id`,
    [`${marca}@test`]
  );
  enfermeroId = enfermeros[0].id;
  await pool.query(
    `INSERT INTO usuario_rol (usuario_id, rol_id)
     SELECT $1, id FROM roles WHERE codigo = 'ENFERMERO'`,
    [enfermeroId]
  );
  const { rows: pacientes } = await pool.query(
    `INSERT INTO pacientes (nombre, apellido, documento)
     VALUES ('Ana', 'Paz', $1), ('Luis', 'Medina', $2), ('Nora', 'Ríos', $3), ('Iván', 'Sosa', $4),
            ('Eva', 'Luna', $5), ('Otto', 'Vega', $6)
     RETURNING id, apellido`,
    [`${marca}-1`, `${marca}-2`, `${marca}-3`, `${marca}-4`, `${marca}-5`, `${marca}-6`]
  );
  pacientesIds.push(...pacientes.map((p) => p.id));
  const porApellido = (apellido) => pacientes.find((p) => p.apellido === apellido).id;

  const clasificar = (apellido, nivel) => admision.clasificarGuardia({
    pacienteId: porApellido(apellido),
    enfermeroId,
    nivel,
  });

  await clasificar('Paz', 'amarillo');
  await clasificar('Ríos', 'verde');
  const rojo = await clasificar('Medina', 'rojo');

  assert.match(rojo.aviso, /Código Rojo: Medina, Luis/);
  assert.equal(avisos.length, 1);
  assert.deepEqual(avisos[0], { pacienteId: porApellido('Medina'), nivel: 'rojo' });

  const cola = await admision.listarGuardia();
  const deEsteTest = cola.filter((fila) => pacientesIds.includes(fila.paciente_id));
  assert.deepEqual(
    deEsteTest.map((fila) => fila.paciente_apellido),
    ['Medina', 'Paz', 'Ríos']
  );
  assert.deepEqual(
    deEsteTest.map((fila) => fila.posicion),
    [deEsteTest[0].posicion, deEsteTest[0].posicion + 1, deEsteTest[0].posicion + 2]
  );
  if (cola.length === deEsteTest.length) {
    assert.equal(deEsteTest[0].posicion, 1);
  }

  await clasificar('Sosa', 'rojo');
  const despues = (await admision.listarGuardia())
    .filter((fila) => pacientesIds.includes(fila.paciente_id));
  assert.deepEqual(
    despues.map((fila) => fila.paciente_apellido),
    ['Medina', 'Sosa', 'Paz', 'Ríos']
  );
  assert.equal(avisos.length, 2);

  const juntos = await Promise.all([clasificar('Luna', 'rojo'), clasificar('Vega', 'rojo')]);
  const posiciones = juntos.map((r) => r.ingreso.posicion);
  assert.equal(new Set(posiciones).size, 2);
  assert.equal(avisos.length, 4);
  const final = (await admision.listarGuardia())
    .filter((fila) => pacientesIds.includes(fila.paciente_id))
    .map((fila) => fila.paciente_apellido);
  assert.deepEqual(final.slice(-2), ['Paz', 'Ríos']);
  assert.ok(final.indexOf('Luna') < final.indexOf('Paz'));
  assert.ok(final.indexOf('Vega') < final.indexOf('Paz'));

  await assert.rejects(
    () => clasificar('Medina', 'azul'),
    (err) => err.status === 400 && /ya está en la cola/.test(err.message)
  );
});
