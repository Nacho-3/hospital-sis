// Flujo de Atencion contra PostgreSQL. Solo corre con DB_TESTS=1 y elimina
// los usuarios y registros clínicos temporales que crea.
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const express = require('express');

const activo = process.env.DB_TESTS === '1';

test('flujo autenticado de signos vitales y medicación prescrita', { skip: !activo }, async (t) => {
  const pool = require('../../../shared/db/pool');
  const eventBus = require('../../../shared/events/eventBus');
  const eventos = require('../../../shared/events/eventos');
  const authRutas = require('../../identidad/rutas/auth.rutas');
  const atencionRutas = require('../rutas');
  const { DomainError } = require('../../../shared/errors/DomainError');

  const jwtSecretAnterior = process.env.JWT_SECRET;
  process.env.JWT_SECRET ||= crypto.randomBytes(32).toString('hex');
  const marca = crypto.randomUUID();
  const password = crypto.randomBytes(24).toString('base64url');
  const emails = {
    enfermero: `test-enfermero-${marca}@example.invalid`,
    medico: `test-medico-${marca}@example.invalid`,
  };
  const ids = {
    enfermero: null,
    medico: null,
    paciente: null,
    insumo: null,
    signos: null,
    indicacion: null,
    administracion: null,
  };
  let server;
  let client;
  let eventoMedicacion;
  const escucharMedicacion = (carga) => { eventoMedicacion = carga; };

  t.after(async () => {
    eventBus.off(eventos.MEDICACION_ADMINISTRADA, escucharMedicacion);
    if (server) await new Promise((resolve) => server.close(resolve));
    if (client) {
      await client.query('ROLLBACK');
      client.release();
    }

    if (ids.indicacion) {
      await pool.query('DELETE FROM administraciones WHERE indicacion_id = $1', [ids.indicacion]);
      await pool.query('DELETE FROM indicaciones WHERE id = $1', [ids.indicacion]);
    }
    if (ids.signos) {
      await pool.query('DELETE FROM notas_enfermeria WHERE signos_vitales_id = $1', [ids.signos]);
      await pool.query('DELETE FROM signos_vitales WHERE id = $1', [ids.signos]);
    }
    const usuariosIds = [ids.enfermero, ids.medico].filter(Boolean);
    if (usuariosIds.length) {
      await pool.query('DELETE FROM usuario_rol WHERE usuario_id = ANY($1::int[])', [usuariosIds]);
      await pool.query('DELETE FROM usuarios WHERE id = ANY($1::int[])', [usuariosIds]);
    }
    await pool.end();
    if (jwtSecretAnterior === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = jwtSecretAnterior;
  });

  const { rows: [datosBase] } = await pool.query(`
    SELECT
      (SELECT id FROM pacientes ORDER BY id LIMIT 1) AS paciente_id,
      (SELECT id FROM insumos WHERE categoria = 'medicamento' ORDER BY id LIMIT 1) AS insumo_id,
      (SELECT id FROM roles WHERE codigo = 'MEDICO') AS medico_role_id,
      (SELECT id FROM roles WHERE codigo = 'ENFERMERO') AS enfermero_role_id,
      (SELECT count(*)::int FROM permisos WHERE codigo IN (
        'signos_vitales:registrar', 'signos_vitales:ver', 'medicacion:administrar',
        'indicacion:ver', 'indicacion:prescribir'
      )) AS permisos_count
  `);
  assert.ok(datosBase.paciente_id && datosBase.insumo_id, 'la base necesita un paciente y un medicamento');
  assert.ok(datosBase.medico_role_id && datosBase.enfermero_role_id, 'faltan los roles clínicos');
  assert.equal(datosBase.permisos_count, 5, 'faltan permisos del módulo Atención');
  ids.paciente = datosBase.paciente_id;
  ids.insumo = datosBase.insumo_id;

  const hash = await bcrypt.hash(password, 10);
  client = await pool.connect();
  await client.query('BEGIN');
  for (const [tipo, email, nombre, roleId] of [
    ['enfermero', emails.enfermero, 'Prueba Enfermería', datosBase.enfermero_role_id],
    ['medico', emails.medico, 'Prueba Médico', datosBase.medico_role_id],
  ]) {
    const { rows: [usuario] } = await client.query(
      `INSERT INTO usuarios (email, password_hash, nombre, apellido)
       VALUES ($1, $2, $3, 'Pruebas DB') RETURNING id`,
      [email, hash, nombre]
    );
    ids[tipo] = usuario.id;
    await client.query(
      'INSERT INTO usuario_rol (usuario_id, rol_id) VALUES ($1, $2)',
      [usuario.id, roleId]
    );
  }
  await client.query('COMMIT');
  client.release();
  client = null;

  const app = express();
  app.use(express.json());
  app.use('/api/identidad/auth', authRutas);
  app.use('/api/atencion', atencionRutas);
  app.use((err, req, res, next) => {
    if (err instanceof DomainError) {
      return res.status(err.status).json({ error: err.code, mensaje: err.message });
    }
    console.error('[atencion DB test]', err);
    res.status(500).json({ error: 'ERROR_INTERNO', mensaje: 'Error interno del servidor' });
  });
  server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  eventBus.on(eventos.MEDICACION_ADMINISTRADA, escucharMedicacion);

  async function pedir(ruta, { metodo = 'GET', token, cuerpo } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (cuerpo !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(`${base}${ruta}`, {
      method: metodo,
      headers,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    const texto = await response.text();
    return { status: response.status, datos: texto ? JSON.parse(texto) : null };
  }

  let respuesta = await pedir('/api/identidad/auth/login', {
    metodo: 'POST',
    cuerpo: { email: emails.enfermero, password },
  });
  assert.equal(respuesta.status, 200, `falló el login del enfermero: ${JSON.stringify(respuesta.datos)}`);
  const sesionEnfermero = respuesta.datos;
  assert.ok(sesionEnfermero.usuario.permisos.includes('medicacion:administrar'));

  respuesta = await pedir('/api/identidad/auth/login', {
    metodo: 'POST',
    cuerpo: { email: emails.medico, password },
  });
  assert.equal(respuesta.status, 200, `falló el login del médico: ${JSON.stringify(respuesta.datos)}`);
  const sesionMedico = respuesta.datos;
  assert.ok(sesionMedico.usuario.permisos.includes('indicacion:prescribir'));

  respuesta = await pedir(`/api/atencion/pacientes/${ids.paciente}/signos-vitales`);
  assert.equal(respuesta.status, 401, 'el historial debe rechazar usuarios no autenticados');

  respuesta = await pedir('/api/atencion/pacientes', { token: sesionEnfermero.token });
  assert.equal(respuesta.status, 200);
  assert.ok(respuesta.datos.some((paciente) => paciente.id === ids.paciente));

  respuesta = await pedir('/api/atencion/signos-vitales', {
    metodo: 'POST',
    token: sesionEnfermero.token,
    cuerpo: {
      pacienteId: ids.paciente,
      presionSistolica: 120,
      presionDiastolica: 80,
      frecuenciaCardiaca: 72,
      temperatura: 36.7,
    },
  });
  assert.equal(respuesta.status, 201, `no se registraron signos: ${JSON.stringify(respuesta.datos)}`);
  assert.equal(respuesta.datos.fueraDeRango, false);
  ids.signos = respuesta.datos.id;

  respuesta = await pedir(`/api/atencion/pacientes/${ids.paciente}/signos-vitales`, {
    token: sesionEnfermero.token,
  });
  assert.equal(respuesta.status, 200);
  assert.ok(respuesta.datos.some((signo) => signo.id === ids.signos));
  const { rows: [nota] } = await pool.query(
    'SELECT count(*)::int AS total FROM notas_enfermeria WHERE signos_vitales_id = $1 AND automatica = TRUE',
    [ids.signos]
  );
  assert.equal(nota.total, 1, 'los signos estables deben crear una nota automática');

  respuesta = await pedir('/api/atencion/indicaciones', {
    metodo: 'POST',
    token: sesionMedico.token,
    cuerpo: {
      pacienteId: ids.paciente,
      insumoId: ids.insumo,
      dosis: '1 unidad (test DB)',
      intervaloHoras: 8,
      margenMinutos: 30,
      primeraDosis: new Date().toISOString(),
    },
  });
  assert.equal(respuesta.status, 201, `no se creó la indicación: ${JSON.stringify(respuesta.datos)}`);
  ids.indicacion = respuesta.datos.id;
  ids.administracion = respuesta.datos.primeraAdministracion.id;

  respuesta = await pedir(`/api/atencion/administraciones/pendientes?pacienteId=${ids.paciente}`, {
    token: sesionEnfermero.token,
  });
  assert.equal(respuesta.status, 200);
  const dosisPendiente = respuesta.datos.find((dosis) => dosis.id === ids.administracion);
  assert.ok(dosisPendiente, 'la primera dosis debe aparecer como pendiente');
  assert.ok(dosisPendiente.insumo_nombre, 'la dosis debe incluir el nombre del medicamento');

  respuesta = await pedir(`/api/atencion/administraciones/${ids.administracion}/confirmar`, {
    metodo: 'POST',
    token: sesionEnfermero.token,
  });
  assert.equal(respuesta.status, 200, `no se confirmó la dosis: ${JSON.stringify(respuesta.datos)}`);
  const { rows: [administracion] } = await pool.query(
    'SELECT estado FROM administraciones WHERE id = $1',
    [ids.administracion]
  );
  assert.equal(administracion.estado, 'administrada');
  assert.equal(eventoMedicacion?.administracionId, ids.administracion);

  const { rows: [siguienteDosis] } = await pool.query(
    `SELECT count(*)::int AS total FROM administraciones
      WHERE indicacion_id = $1 AND estado = 'pendiente'`,
    [ids.indicacion]
  );
  assert.equal(siguienteDosis.total, 1, 'debe programarse la próxima dosis');

  respuesta = await pedir(`/api/atencion/administraciones/${ids.administracion}/confirmar`, {
    metodo: 'POST',
    token: sesionEnfermero.token,
  });
  assert.equal(respuesta.status, 409, 'la dosis no se debe poder confirmar dos veces');
});
