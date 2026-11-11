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

test('Publica (HU 1.1 esc. 1): cargo de $0 al paciente y el total al estado', () => {
  const resultado = calcularDistribucionCargo({
    montoTotal: 15000,
    cobertura: { tipo: 'publica', nombre: 'Obra Social Pública' },
    nombrePaciente: 'Juan Gómez',
  });

  assert.deepEqual(resultado, [
    { monto: 0, destinatario: 'paciente', destinatarioNombre: 'Juan Gómez' },
    { monto: 15000, destinatario: 'estado', destinatarioNombre: 'Obra Social Pública' },
  ]);
});

test('Prepaga (HU 1.1 esc. 2): copago fijo al paciente y el resto a la prepaga', () => {
  const cobertura = { tipo: 'prepaga', nombre: 'Medicina Prepaga Premium', copago_fijo: 3000 };
  const resultado = calcularDistribucionCargo({ montoTotal: 15000, cobertura, nombrePaciente: 'Ana Rojas' });

  assert.deepEqual(resultado, [
    { monto: 3000, destinatario: 'paciente', destinatarioNombre: 'Ana Rojas' },
    { monto: 12000, destinatario: 'obra_social', destinatarioNombre: 'Medicina Prepaga Premium' },
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

test('Prepaga sin copago configurado: $0 al paciente y todo a la obra social', () => {
  const resultado = calcularDistribucionCargo({
    montoTotal: 1000,
    cobertura: { tipo: 'prepaga', nombre: 'OSDE', copago_fijo: null },
  });

  assert.deepEqual(resultado, [
    { monto: 0, destinatario: 'paciente', destinatarioNombre: 'Paciente' },
    { monto: 1000, destinatario: 'obra_social', destinatarioNombre: 'OSDE' },
  ]);
});

test('Las partes siempre suman el total, tambien con centavos', () => {
  const cobertura = { tipo: 'prepaga', nombre: 'OSDE', copago_fijo: 0.1 };
  const resultado = calcularDistribucionCargo({ montoTotal: 0.3, cobertura });

  // En punto flotante 0.3 - 0.1 da 0.19999999999999998.
  assert.deepEqual(resultado.map((parte) => parte.monto), [0.1, 0.2]);
});

test('Un monto de $0 deja solo la parte del paciente, en $0', () => {
  assert.deepEqual(calcularDistribucionCargo({ montoTotal: 0, cobertura: OSDE }), [
    { monto: 0, destinatario: 'paciente', destinatarioNombre: 'Paciente' },
  ]);
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
