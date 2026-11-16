const { DomainError } = require('../../../shared/errors/DomainError');

class ErrorNegocio extends DomainError {
  constructor(mensaje, codigo = 'ERROR_DE_NEGOCIO', status = 422) {
    super(mensaje, { code: codigo, status });
  }
}

module.exports = { ErrorNegocio };
