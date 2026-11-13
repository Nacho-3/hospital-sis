const { DomainError } = require('../../../shared/errors/DomainError');

class CredencialesInvalidasError extends DomainError {
  constructor() {
    super('Credenciales inválidas', { code: 'CREDENCIALES_INVALIDAS', status: 401 });
  }
}

class DatosInvalidosError extends DomainError {
  constructor(message) {
    super(message, { code: 'DATOS_INVALIDOS', status: 400 });
  }
}

class NoAutenticadoError extends DomainError {
  constructor() {
    super('Token no proporcionado o inválido', { code: 'NO_AUTENTICADO', status: 401 });
  }
}

class PermisoDenegadoError extends DomainError {
  constructor() {
    super('No tenés permiso para realizar esta acción', { code: 'PERMISO_DENEGADO', status: 403 });
  }
}

class UsuarioExistenteError extends DomainError {
  constructor() {
    super('El email ya está registrado', { code: 'EMAIL_YA_REGISTRADO', status: 409 });
  }
}

class RolInexistenteError extends DomainError {
  constructor() {
    super('Alguno de los roles no existe', { code: 'ROL_INEXISTENTE', status: 400 });
  }
}

module.exports = {
  CredencialesInvalidasError,
  DatosInvalidosError,
  NoAutenticadoError,
  PermisoDenegadoError,
  UsuarioExistenteError,
  RolInexistenteError,
};