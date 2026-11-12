const { DomainError } = require('../../../shared/errors/DomainError');

// La cobertura no permite calcular el reparto (tipo desconocido, copago o monto invalido).
class CoberturaInvalidaError extends DomainError {
  constructor(mensaje) {
    super(mensaje, { code: 'COBERTURA_INVALIDA', status: 422 });
  }
}

// Llego una medicacion de un insumo que Facturacion no sabe cuanto cuesta.
class PrecioNoDefinidoError extends DomainError {
  constructor(insumoId) {
    super(`El insumo ${insumoId} no tiene un precio vigente en precios_insumo.`, {
      code: 'PRECIO_NO_DEFINIDO',
      status: 409,
    });
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

module.exports = {
  CoberturaInvalidaError,
  PrecioNoDefinidoError,
  NoEncontradoError,
  DatosInvalidosError,
};
