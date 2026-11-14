const { DomainError, ConcurrenciaError } = require('../../../shared/errors/DomainError');

// HU 1.1 escenario 2: la segunda recepcionista llega cuando el turno
// ya no esta libre. 409, no un error generico.
class TurnoOcupadoError extends ConcurrenciaError {
  constructor() {
    super('El turno acaba de ser ocupado.');
  }
}

class NoEncontradoError extends DomainError {
  constructor(que, id) {
    super(`No existe ${que} ${id}.`, { code: 'NO_ENCONTRADO', status: 404 });
  }
}

class DatosInvalidosError extends DomainError {
  constructor(mensaje) {
    super(mensaje, { code: 'DATOS_INVALIDOS', status: 400 });
  }
}

class HorarioSuperpuestoError extends DomainError {
  constructor() {
    super('Ese horario se superpone con otro turno del mismo médico.', {
      code: 'HORARIO_SUPERPUESTO',
      status: 409,
    });
  }
}

module.exports = {
  TurnoOcupadoError,
  NoEncontradoError,
  DatosInvalidosError,
  HorarioSuperpuestoError,
};
