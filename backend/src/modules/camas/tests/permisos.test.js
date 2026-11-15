// Permisos de las rutas de camas. Los casos 401 y 403 no tocan la base:
// los middlewares cortan antes. El caso permitido necesita PostgreSQL y
// solo corre con DB_TESTS=1, como los otros tests *.db.
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-test';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const app = require('../../../app');

const tokenCon = (...permisos) =>
  jwt.sign({ id: 1, email: 'test@his.local', permisos }, process.env.JWT_SECRET, { expiresIn: '5m' });

let servidor;
let base;

test.before(async () => {
  servidor = app.listen(0);
  await new Promise((r) => servidor.once('listening', r));
  base = `http://127.0.0.1:${servidor.address().port}/api/camas`;
});

test.after(async () => {
  servidor.close();
  try {
    await require('../../../shared/db/pool').end();
  } catch (_) {
    // El pool pudo no haberse usado.
  }
});

async function pedir(ruta, { token, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${ruta}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, datos: await res.json().catch(() => null) };
}

test('sin token: 401 en todas las rutas', async () => {
  for (const [ruta, method] of [['/', 'GET'], ['/1/asignar', 'POST'], ['/inventario', 'GET'], ['/1/finalizar-limpieza', 'POST']]) {
    const r = await pedir(ruta, { method });
    assert.equal(r.status, 401, `${method} ${ruta}`);
    assert.equal(r.datos.error, 'NO_AUTENTICADO');
  }
});

test('token invalido: 401', async () => {
  const r = await pedir('/', { token: 'cualquier-cosa' });
  assert.equal(r.status, 401);
});

test('personal de limpieza no puede asignar ni ver inventario: 403', async () => {
  const limpieza = tokenCon('cama:ver_mapa', 'cama:confirmar_limpieza');
  assert.equal((await pedir('/1/asignar', { token: limpieza, method: 'POST', body: { pacienteId: 1 } })).status, 403);
  assert.equal((await pedir('/1/mantenimiento', { token: limpieza, method: 'POST' })).status, 403);
  assert.equal((await pedir('/inventario', { token: limpieza })).status, 403);
  assert.equal((await pedir('/pacientes-sin-cama', { token: limpieza })).status, 403);
});

test('administrativo de piso no puede confirmar limpieza ni reponer: 403', async () => {
  const administrativo = tokenCon('cama:asignar', 'cama:ver_mapa');
  const r = await pedir('/1/finalizar-limpieza', { token: administrativo, method: 'POST' });
  assert.equal(r.status, 403);
  assert.equal(r.datos.error, 'PERMISO_DENEGADO');
  assert.equal((await pedir('/inventario/1/reponer', { token: administrativo, method: 'POST', body: { cantidad: 1 } })).status, 403);
});

test('gestor de inventario no ve el mapa de camas: 403', async () => {
  const gestor = tokenCon('inventario:ver', 'inventario:reponer');
  assert.equal((await pedir('/', { token: gestor })).status, 403);
});

test('canal en vivo: 401 sin token, 403 sin permisos de camas ni inventario', async () => {
  const sinToken = await fetch(`${base}/en-vivo`);
  assert.equal(sinToken.status, 401);
  const otro = tokenCon('turno:reservar');
  const sinPermiso = await fetch(`${base}/en-vivo?token=${otro}`);
  assert.equal(sinPermiso.status, 403);
});

test('con el permiso correcto pasa', { skip: process.env.DB_TESTS !== '1' }, async () => {
  const administrativo = tokenCon('cama:asignar', 'cama:ver_mapa');
  const mapa = await pedir('/', { token: administrativo });
  assert.equal(mapa.status, 200);
  assert.ok(Array.isArray(mapa.datos));

  const gestor = tokenCon('inventario:ver', 'inventario:reponer');
  assert.equal((await pedir('/inventario', { token: gestor })).status, 200);

  // Canal en vivo con el token por query (EventSource no manda headers).
  const controlador = new AbortController();
  const vivo = await fetch(`${base}/en-vivo?token=${gestor}`, { signal: controlador.signal });
  assert.equal(vivo.status, 200);
  assert.match(vivo.headers.get('content-type'), /text\/event-stream/);
  controlador.abort();
});
