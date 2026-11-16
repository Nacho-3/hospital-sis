// Permisos de Admision contra la base real, con usuarios de cada rol.
// Solo corre con DB_TESTS=1. Identidad lee los permisos de la base en cada
// pedido, asi que los usuarios tienen roles reales (usuario_rol).
// Los POST se mandan con el cuerpo vacio: si el permiso alcanza, el pedido
// pasa la autorizacion y lo frena la validacion (400), sin crear datos.
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-test';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const activo = process.env.DB_TESTS === '1';

test('admision: 401 sin sesion, 403 sin permiso y cada rol hace lo suyo', { skip: !activo }, async (t) => {
  const pool = require('../../../shared/db/pool');
  const app = require('../../../app');
  const servidor = app.listen(0);
  await new Promise((r) => servidor.once('listening', r));
  const base = `http://127.0.0.1:${servidor.address().port}/api/admision`;

  const marca = `adm${Date.now()}`;
  const creados = [];
  t.after(async () => {
    await pool.query('DELETE FROM usuario_rol WHERE usuario_id = ANY($1)', [creados]);
    await pool.query('DELETE FROM usuarios WHERE id = ANY($1)', [creados]);
    servidor.close();
    await pool.end();
  });

  async function tokenDe(rol) {
    const { rows: [u] } = await pool.query(
      `INSERT INTO usuarios (email, password_hash, nombre, apellido)
       VALUES ($1, 'x', 'Test', $2) RETURNING id`,
      [`${marca}-${rol.toLowerCase()}@test.local`, rol]
    );
    creados.push(u.id);
    await pool.query(
      'INSERT INTO usuario_rol (usuario_id, rol_id) SELECT $1, id FROM roles WHERE codigo = $2',
      [u.id, rol]
    );
    return jwt.sign({ id: u.id, email: 'x' }, process.env.JWT_SECRET);
  }

  const RECEPCIONISTA = await tokenDe('RECEPCIONISTA');
  const COORDINADOR = await tokenDe('COORDINADOR_AGENDAS');
  const ENFERMERO = await tokenDe('ENFERMERO');
  const MEDICO = await tokenDe('MEDICO');
  const LIMPIEZA = await tokenDe('PERSONAL_LIMPIEZA');

  const status = async (ruta, tk, method = 'GET') => {
    const headers = { 'Content-Type': 'application/json' };
    if (tk) headers.Authorization = `Bearer ${tk}`;
    const res = await fetch(`${base}${ruta}`, { method, headers, body: method === 'GET' ? undefined : '{}' });
    return res.status;
  };

  // Sin sesion
  assert.equal(await status('/turnos'), 401);
  assert.equal(await status('/pacientes', null, 'POST'), 401);

  // Un rol sin ningun permiso de Admision
  assert.equal(await status('/pacientes', LIMPIEZA), 403);
  assert.equal(await status('/turnos', LIMPIEZA), 403);

  // Recepcionista: pacientes, agenda, reserva, estados, cancelacion y lista de espera
  assert.equal(await status('/pacientes', RECEPCIONISTA), 200);
  assert.equal(await status('/turnos', RECEPCIONISTA), 200);
  assert.equal(await status('/lista-espera', RECEPCIONISTA), 200);
  assert.equal(await status('/pacientes', RECEPCIONISTA, 'POST'), 400, 'pasa la autorizacion');
  assert.notEqual(await status('/turnos/999999/reservar', RECEPCIONISTA, 'POST'), 403);
  assert.notEqual(await status('/turnos/999999/confirmar', RECEPCIONISTA, 'POST'), 403);
  assert.equal(await status('/turnos', RECEPCIONISTA, 'POST'), 403, 'abrir turnos es del coordinador');
  assert.equal(await status('/turnos/999999/entreturno', RECEPCIONISTA, 'POST'), 403);
  assert.equal(await status('/guardia', RECEPCIONISTA), 403);

  // Coordinador de agendas: abre turnos y entreturnos, no registra pacientes ni reserva
  assert.equal(await status('/turnos', COORDINADOR), 200);
  assert.equal(await status('/turnos', COORDINADOR, 'POST'), 400, 'pasa la autorizacion');
  assert.notEqual(await status('/turnos/999999/entreturno', COORDINADOR, 'POST'), 403);
  assert.equal(await status('/pacientes', COORDINADOR, 'POST'), 403);
  assert.equal(await status('/turnos/999999/reservar', COORDINADOR, 'POST'), 403);

  // Enfermero: guardia (ver y clasificar), no la agenda
  assert.equal(await status('/guardia', ENFERMERO), 200);
  assert.equal(await status('/enfermeros', ENFERMERO), 200);
  assert.equal(await status('/pacientes', ENFERMERO), 200);
  assert.equal(await status('/guardia', ENFERMERO, 'POST'), 400, 'pasa la autorizacion');
  assert.equal(await status('/turnos', ENFERMERO), 403);

  // Medico: ve la agenda y la guardia, no cambia nada
  assert.equal(await status('/turnos', MEDICO), 200);
  assert.equal(await status('/guardia', MEDICO), 200);
  assert.equal(await status('/guardia', MEDICO, 'POST'), 403);
  assert.equal(await status('/turnos/999999/atender', MEDICO, 'POST'), 403);
  assert.equal(await status('/observacion', MEDICO, 'POST'), 403);
});
