const { DomainError } = require('../../../shared/errors/DomainError');

class DatosInvalidosError extends DomainError {
  constructor(mensaje) {
    super(mensaje, { code: 'DATOS_INVALIDOS', status: 400 });
  }
}

class NoEncontradoError extends DomainError {
  constructor(que, id) {
    super(`No existe ${que} ${id}.`, { code: 'NO_ENCONTRADO', status: 404 });
  }
}

class YaRectificadoError extends DomainError {
  constructor() {
    super('Ese registro ya fue rectificado.', { code: 'YA_RECTIFICADO', status: 409 });
  }
}

class AlergiaDuplicadaError extends DomainError {
  constructor(sustancia) {
    super(`El paciente ya tiene registrada una alergia vigente a ${sustancia}.`, {
      code: 'ALERGIA_DUPLICADA',
      status: 409,
    });
  }
}

module.exports = { DatosInvalidosError, NoEncontradoError, YaRectificadoError, AlergiaDuplicadaError };
