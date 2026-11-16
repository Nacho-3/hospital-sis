// Permisos de Facturacion contra la base real, con usuarios de cada rol.
// Solo corre con DB_TESTS=1. Los POST/PUT van con el cuerpo vacio: si el
// permiso alcanza, lo frena la validacion (400) y no se crean datos.
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-test';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const activo = process.env.DB_TESTS === '1';

test('facturacion: 401 sin sesion, 403 sin permiso y el analista opera', { skip: !activo }, async (t) => {
  const pool = require('../../../shared/db/pool');
  const app = require('../../../app');
  const servidor = app.listen(0);
  await new Promise((r) => servidor.once('listening', r));
  const base = `http://127.0.0.1:${servidor.address().port}/api/facturacion`;

  const marca = `fac${Date.now()}`;
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

  const ANALISTA = await tokenDe('ANALISTA_FACTURACION');
  const RECEPCIONISTA = await tokenDe('RECEPCIONISTA');

  const status = async (ruta, tk, method = 'GET') => {
    const headers = { 'Content-Type': 'application/json' };
    if (tk) headers.Authorization = `Bearer ${tk}`;
    const res = await fetch(`${base}${ruta}`, { method, headers, body: method === 'GET' ? undefined : '{}' });
    return res.status;
  };

  // /health es publica
  assert.equal(await status('/health'), 200);

  // Sin sesion
  assert.equal(await status('/coberturas'), 401);
  assert.equal(await status('/cuenta/1'), 401);
  assert.equal(await status('/cuenta/1/cargos', null, 'POST'), 401);

  // Un rol de otro modulo no ve cuentas ni factura
  assert.equal(await status('/cuenta/1', RECEPCIONISTA), 403);
  assert.equal(await status('/coberturas', RECEPCIONISTA), 403);
  assert.equal(await status('/cuenta/1/cargos', RECEPCIONISTA, 'POST'), 403);
  assert.equal(await status('/cobertura/1', RECEPCIONISTA, 'PUT'), 403);

  // Analista de facturacion: consulta y factura
  assert.equal(await status('/coberturas', ANALISTA), 200);
  assert.equal(await status('/nomenclador', ANALISTA), 200);
  assert.equal(await status('/precios-insumo', ANALISTA), 200);
  assert.notEqual(await status('/cuenta/1', ANALISTA), 403);
  assert.equal(await status('/cuenta/1/cargos', ANALISTA, 'POST'), 400, 'pasa la autorizacion');
  assert.equal(await status('/cuenta/1/prestaciones', ANALISTA, 'POST'), 400, 'pasa la autorizacion');
});
