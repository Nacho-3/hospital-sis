// Error base para reglas de negocio. Los modulos extienden esta clase.
class DomainError extends Error {
  constructor(message, { code = 'ERROR_DE_NEGOCIO', status = 422 } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
  }
}

// Concurrencia: la misma clase sirve para turno ocupado y cama ocupada (HU 1.1 de Admision y Camas)
class ConcurrenciaError extends DomainError {
  constructor(message) {
    super(message, { code: 'CONFLICTO_DE_CONCURRENCIA', status: 409 });
  }
}

class TransicionInvalidaError extends DomainError {
  constructor(message) {
    super(message, { code: 'TRANSICION_INVALIDA', status: 422 });
  }
}

module.exports = { DomainError, ConcurrenciaError, TransicionInvalidaError };
