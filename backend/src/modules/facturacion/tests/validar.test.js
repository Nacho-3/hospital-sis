const test = require('node:test');
const assert = require('node:assert/strict');
const { enteroPositivo, texto, monto } = require('../servicio/validar');
const { DatosInvalidosError } = require('../dominio/errores');

test('enteroPositivo acepta el numero o su texto en digitos', () => {
  assert.equal(enteroPositivo(7, 'id'), 7);
  assert.equal(enteroPositivo('7', 'id'), 7);
});

test('enteroPositivo rechaza todo lo demas', () => {
  for (const valor of [0, -1, 1.5, 'abc', '', ' 7', '1e3', '0x10', '7; DROP TABLE cargos', null, undefined, true, {}]) {
    assert.throws(() => enteroPositivo(valor, 'id'), DatosInvalidosError, `valor: ${String(valor)}`);
  }
});

test('texto recorta espacios y controla que exista y el largo', () => {
  assert.equal(texto('  Radiografia  ', 'concepto'), 'Radiografia');
  assert.throws(() => texto('   ', 'concepto'), DatosInvalidosError);
  assert.throws(() => texto(undefined, 'concepto'), DatosInvalidosError);
  assert.throws(() => texto('x'.repeat(161), 'concepto'), DatosInvalidosError);
});

test('monto acepta numeros positivos con centavos', () => {
  assert.equal(monto(8500, 'monto'), 8500);
  assert.equal(monto(8500.55, 'monto'), 8500.55);
  assert.equal(monto(0.01, 'monto'), 0.01);
});

test('monto rechaza cero, negativos, texto, mas de dos decimales y montos fuera de rango', () => {
  for (const valor of [0, -10, '8500', NaN, Infinity, 10.005, 1e12, null, undefined]) {
    assert.throws(() => monto(valor, 'monto'), DatosInvalidosError, `valor: ${String(valor)}`);
  }
});
