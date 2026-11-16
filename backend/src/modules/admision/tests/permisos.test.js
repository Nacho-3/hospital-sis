// Sin base: revisa que ninguna ruta de Admision quede sin pedir sesion.
// Si alguien agrega una ruta y se olvida de con()/conAlguno(), este test falla.
const test = require('node:test');
const assert = require('node:assert/strict');
const { autenticar } = require('../../identidad');
const router = require('../rutas');

test('todas las rutas de admision piden sesion (autenticar)', () => {
  const rutas = router.stack.filter((capa) => capa.route);
  assert.ok(rutas.length > 0);
  for (const capa of rutas) {
    const metodo = Object.keys(capa.route.methods)[0].toUpperCase();
    const protegida = capa.route.stack.some((c) => c.handle === autenticar);
    assert.ok(protegida, `${metodo} ${capa.route.path} no pide sesion`);
  }
});
