const test = require('node:test');
const assert = require('node:assert/strict');
const { calcularDistribucionCargo } = require('../dominio/EstrategiaCobertura');
const { CoberturaInvalidaError } = require('../dominio/errores');

const OSDE = { tipo: 'prepaga', nombre: 'OSDE', copago_fijo: 2000 };

test('Particular: el paciente paga el 100%', () => {
  const resultado = calcularDistribucionCargo({
    montoTotal: 5000,
    cobertura: { tipo: 'particular', nombre: 'Particular' },
    nombrePaciente: 'Carlos López',
  });

  assert.deepEqual(resultado, [
    { monto: 5000, destinatario: 'paciente', destinatarioNombre: 'Carlos López' },
  ]);
});

test('Sin cobertura se factura como particular', () => {
  const resultado = calcularDistribucionCargo({ montoTotal: 5000, cobertura: null, nombrePaciente: 'Ana' });

  assert.deepEqual(resultado, [{ monto: 5000, destinatario: 'paciente', destinatarioNombre: 'Ana' }]);
});

test('Publica: el paciente paga 0 y el estado paga el total', () => {
  const resultado = calcularDistribucionCargo({
    montoTotal: 12000,
    cobertura: { tipo: 'publica', nombre: 'Hospital Publico' },
    nombrePaciente: 'Ana Gomez',
  });

  // Al paciente no se le genera un cargo de $0: solo figura el estado.
  assert.deepEqual(resultado, [
    { monto: 12000, destinatario: 'estado', destinatarioNombre: 'Hospital Publico' },
  ]);
});

test('Prepaga: copago fijo al paciente y el resto a la obra social', () => {
  const resultado = calcularDistribucionCargo({ montoTotal: 8500, cobertura: OSDE, nombrePaciente: 'Luis Medina' });

  assert.deepEqual(resultado, [
    { monto: 2000, destinatario: 'paciente', destinatarioNombre: 'Luis Medina' },
    { monto: 6500, destinatario: 'obra_social', destinatarioNombre: 'OSDE' },
  ]);
});

test('Prepaga: si el monto no supera el copago, el paciente paga todo', () => {
  const cobertura = { tipo: 'prepaga', nombre: 'Swiss Medical', copago_fijo: 5000 };

  for (const montoTotal of [3000, 5000]) {
    const resultado = calcularDistribucionCargo({ montoTotal, cobertura, nombrePaciente: 'Maria Perez' });
    assert.deepEqual(resultado, [
      { monto: montoTotal, destinatario: 'paciente', destinatarioNombre: 'Maria Perez' },
    ]);
  }
});

test('Prepaga sin copago configurado: la obra social paga todo', () => {
  const resultado = calcularDistribucionCargo({
    montoTotal: 1000,
    cobertura: { tipo: 'prepaga', nombre: 'OSDE', copago_fijo: null },
  });

  assert.deepEqual(resultado, [{ monto: 1000, destinatario: 'obra_social', destinatarioNombre: 'OSDE' }]);
});

test('Las partes siempre suman el total, tambien con centavos', () => {
  const cobertura = { tipo: 'prepaga', nombre: 'OSDE', copago_fijo: 0.1 };
  const resultado = calcularDistribucionCargo({ montoTotal: 0.3, cobertura });

  // En punto flotante 0.3 - 0.1 da 0.19999999999999998.
  assert.deepEqual(resultado.map((parte) => parte.monto), [0.1, 0.2]);
});

test('Un monto de $0 no genera partes', () => {
  assert.deepEqual(calcularDistribucionCargo({ montoTotal: 0, cobertura: OSDE }), []);
});

test('Validacion: rechaza un tipo de cobertura desconocido', () => {
  for (const tipo of ['invalido', 'constructor', '__proto__', undefined]) {
    assert.throws(
      () => calcularDistribucionCargo({ montoTotal: 1000, cobertura: { tipo, nombre: 'X' } }),
      CoberturaInvalidaError
    );
  }
});

test('Validacion: rechaza un monto que no es un numero mayor o igual a cero', () => {
  for (const montoTotal of [-500, NaN, Infinity, '1000', null, undefined]) {
    assert.throws(
      () => calcularDistribucionCargo({ montoTotal, cobertura: { tipo: 'particular', nombre: 'Particular' } }),
      CoberturaInvalidaError
    );
  }
});

test('Validacion: rechaza un copago negativo', () => {
  assert.throws(
    () => calcularDistribucionCargo({ montoTotal: 1000, cobertura: { ...OSDE, copago_fijo: -1 } }),
    CoberturaInvalidaError
  );
});
