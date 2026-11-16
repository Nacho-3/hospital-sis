// Sin base: revisa que ninguna ruta de Facturacion quede sin pedir sesion,
// salvo /health, que solo dice si el modulo esta activo.
const test = require('node:test');
const assert = require('node:assert/strict');
const { autenticar } = require('../../identidad');
const router = require('../rutas');

const PUBLICAS = ['/health'];

test('todas las rutas de facturacion piden sesion (autenticar), salvo /health', () => {
  const rutas = router.stack.filter((capa) => capa.route && !PUBLICAS.includes(capa.route.path));
  assert.ok(rutas.length > 0);
  for (const capa of rutas) {
    const metodo = Object.keys(capa.route.methods)[0].toUpperCase();
    const protegida = capa.route.stack.some((c) => c.handle === autenticar);
    assert.ok(protegida, `${metodo} ${capa.route.path} no pide sesion`);
  }
});
