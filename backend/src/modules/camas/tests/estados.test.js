const test = require('node:test');
const assert = require('node:assert/strict');
const Cama = require('../dominio/Cama');
const { TransicionInvalidaError, ConcurrenciaError } = require('../../../shared/errors/DomainError');
const { CamaReservadaError } = require('../dominio/errores');

const nueva = (estado, extra = {}) =>
  new Cama({ id: 1, codigo: '101', habitacionId: 1, estado, ...extra });

test('flujo completo: disponible -> reservada -> ocupada -> en_limpieza -> disponible', () => {
  const cama = nueva('disponible');
  cama.reservar(7);
  assert.equal(cama.nombreEstado, 'reservada');
  assert.equal(cama.reservadaPara, 7);

  cama.asignar(7);
  assert.equal(cama.nombreEstado, 'ocupada');
  assert.equal(cama.reservadaPara, null);

  cama.liberar();
  assert.equal(cama.nombreEstado, 'en_limpieza');

  cama.finalizarLimpieza();
  assert.equal(cama.nombreEstado, 'disponible');
});

test('una cama disponible se puede asignar sin reserva', () => {
  const cama = nueva('disponible');
  cama.asignar(3);
  assert.equal(cama.nombreEstado, 'ocupada');
});

test('una cama reservada solo la ocupa el paciente de la reserva', () => {
  const cama = nueva('reservada', { reservadaPara: 7 });
  assert.throws(() => cama.asignar(8), CamaReservadaError);
  assert.equal(cama.nombreEstado, 'reservada');
});

test('la reserva se puede cancelar y la cama vuelve a disponible', () => {
  const cama = nueva('reservada', { reservadaPara: 7 });
  cama.cancelarReserva();
  assert.equal(cama.nombreEstado, 'disponible');
  assert.equal(cama.reservadaPara, null);
});

test('asignar una cama ocupada es un error de concurrencia (409)', () => {
  const cama = nueva('ocupada');
  assert.throws(() => cama.asignar(2), (err) => err instanceof ConcurrenciaError && err.status === 409);
});

test('una cama ocupada no pasa directo a disponible', () => {
  const cama = nueva('ocupada');
  assert.throws(() => cama.finalizarLimpieza(), TransicionInvalidaError);
  assert.throws(() => cama.finalizarMantenimiento(), TransicionInvalidaError);
  assert.throws(() => cama.enviarAMantenimiento(), TransicionInvalidaError);
  assert.equal(cama.nombreEstado, 'ocupada');
});

test('una cama en limpieza no se puede asignar ni reservar (HU 2.1 escenario 1)', () => {
  const cama = nueva('en_limpieza');
  assert.throws(() => cama.asignar(1), TransicionInvalidaError);
  assert.throws(() => cama.reservar(1), TransicionInvalidaError);
});

test('mantenimiento: desde disponible o en limpieza, y vuelve a disponible', () => {
  for (const inicial of ['disponible', 'en_limpieza']) {
    const cama = nueva(inicial);
    cama.enviarAMantenimiento();
    assert.equal(cama.nombreEstado, 'en_mantenimiento');
    assert.throws(() => cama.asignar(1), TransicionInvalidaError);
    cama.finalizarMantenimiento();
    assert.equal(cama.nombreEstado, 'disponible');
  }
});

test('una cama reservada no puede ir a mantenimiento', () => {
  const cama = nueva('reservada', { reservadaPara: 4 });
  assert.throws(() => cama.enviarAMantenimiento(), TransicionInvalidaError);
});

test('el mensaje de error dice el estado actual', () => {
  const cama = nueva('en_mantenimiento');
  assert.throws(() => cama.liberar(), /en mantenimiento/);
});
