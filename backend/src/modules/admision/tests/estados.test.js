const test = require('node:test');
const assert = require('node:assert/strict');
const Turno = require('../dominio/Turno');
const { TransicionInvalidaError } = require('../../../shared/errors/DomainError');
const { TurnoOcupadoError } = require('../dominio/errores');

const turno = (estado) => Turno.desdeFila({ id: 1, estado });

test('el turno recorre programado, confirmado, sala de espera y atendido', () => {
  const t = turno('disponible');
  t.reservar();
  assert.equal(t.nombreEstado, 'programado');
  t.confirmar();
  assert.equal(t.nombreEstado, 'confirmado');
  t.recibir();
  assert.equal(t.nombreEstado, 'en_sala_de_espera');
  t.atender();
  assert.equal(t.nombreEstado, 'atendido');
});

test('programado y confirmado se pueden cancelar', () => {
  for (const inicial of ['programado', 'confirmado']) {
    const t = turno(inicial);
    t.cancelar();
    assert.equal(t.nombreEstado, 'cancelado');
  }
});

test('no se salta la confirmacion para entrar a la sala', () => {
  const t = turno('programado');
  assert.throws(() => t.recibir(), TransicionInvalidaError);
  assert.equal(t.nombreEstado, 'programado');
});

test('no se marca atendido sin haber pasado por la sala', () => {
  const t = turno('confirmado');
  assert.throws(() => t.atender(), TransicionInvalidaError);
  assert.equal(t.nombreEstado, 'confirmado');
});

test('un turno cancelado no puede pasar a atendido', () => {
  const t = turno('cancelado');
  assert.throws(
    () => t.atender(),
    (err) => err instanceof TransicionInvalidaError
      && err.status === 422
      && /no puede pasar a atendido/.test(err.message)
  );
  assert.equal(t.nombreEstado, 'cancelado');
});

test('reservar un turno que no esta libre es el 409 de la HU 1.1', () => {
  const t = turno('programado');
  assert.throws(() => t.reservar(), (err) => err instanceof TurnoOcupadoError && err.status === 409);
  assert.equal(t.nombreEstado, 'programado');
});
