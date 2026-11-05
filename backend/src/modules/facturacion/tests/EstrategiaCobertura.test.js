const test = require('node:test');
const assert = require('node:assert');
const {
  calcularDistribucionCargo,
  CoberturaInvalidaError,
} = require('../dominio/EstrategiaCobertura');

test('Estrategia Particular: calcula 100% a cargo del paciente', () => {
  const cobertura = { tipo: 'particular', nombre: 'Particular' };
  const resultado = calcularDistribucionCargo({
    montoTotal: 5000,
    cobertura,
    nombrePaciente: 'Carlos López',
  });

  assert.strictEqual(resultado.length, 1);
  assert.strictEqual(resultado[0].monto, 5000);
  assert.strictEqual(resultado[0].destinatario, 'paciente');
  assert.strictEqual(resultado[0].destinatarioNombre, 'Carlos López');
});

test('Estrategia Publica: paciente paga 0 y el estado paga el total', () => {
  const cobertura = { tipo: 'publica', nombre: 'Hospital Publico' };
  const resultado = calcularDistribucionCargo({
    montoTotal: 12000,
    cobertura,
    nombrePaciente: 'Ana Gomez',
  });

  assert.strictEqual(resultado.length, 2);
  assert.strictEqual(resultado[0].monto, 0);
  assert.strictEqual(resultado[0].destinatario, 'paciente');
  
  assert.strictEqual(resultado[1].monto, 12000);
  assert.strictEqual(resultado[1].destinatario, 'estado');
  assert.strictEqual(resultado[1].destinatarioNombre, 'Hospital Publico');
});

test('Estrategia Prepaga: divide entre copago fijo del paciente y saldo de obra social', () => {
  const cobertura = { tipo: 'prepaga', nombre: 'OSDE', copago_fijo: 2000 };
  const resultado = calcularDistribucionCargo({
    montoTotal: 8500,
    cobertura,
    nombrePaciente: 'Luis Medina',
  });

  assert.strictEqual(resultado.length, 2);
  // Paciente paga el copago fijo
  assert.strictEqual(resultado[0].monto, 2000);
  assert.strictEqual(resultado[0].destinatario, 'paciente');
  
  // Obra social paga el resto (8500 - 2000 = 6500)
  assert.strictEqual(resultado[1].monto, 6500);
  assert.strictEqual(resultado[1].destinatario, 'obra_social');
  assert.strictEqual(resultado[1].destinatarioNombre, 'OSDE');
});

test('Estrategia Prepaga: si el monto es menor al copago fijo, paciente paga el total y obra social 0', () => {
  const cobertura = { tipo: 'prepaga', nombre: 'Swiss Medical', copago_fijo: 5000 };
  const resultado = calcularDistribucionCargo({
    montoTotal: 3000,
    cobertura,
    nombrePaciente: 'Maria Perez',
  });

  assert.strictEqual(resultado.length, 1);
  assert.strictEqual(resultado[0].monto, 3000);
  assert.strictEqual(resultado[0].destinatario, 'paciente');
});

test('Validacion: lanza error si el tipo de cobertura es desconocido', () => {
  const cobertura = { tipo: 'invalido', nombre: 'X' };
  assert.throws(() => {
    calcularDistribucionCargo({ montoTotal: 1000, cobertura });
  }, CoberturaInvalidaError);
});

test('Validacion: lanza error si el monto total es negativo', () => {
  const cobertura = { tipo: 'particular' };
  assert.throws(() => {
    calcularDistribucionCargo({ montoTotal: -500, cobertura });
  }, CoberturaInvalidaError);
});