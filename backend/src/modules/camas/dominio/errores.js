const {
  DomainError,
  ConcurrenciaError,
} = require('../../../shared/errors/DomainError');

// La cama ya tiene un paciente. Es el error de la HU 1.1 escenario 2:
// dos administrativos asignan la misma cama y el segundo llega tarde.
class CamaOcupadaError extends ConcurrenciaError {
  constructor(codigo) {
    super(`La cama ${codigo} acaba de ser ocupada por otro paciente.`);
  }
}

class CamaReservadaError extends DomainError {
  constructor(codigo) {
    super(`La cama ${codigo} está reservada para otro paciente.`, {
      code: 'CAMA_RESERVADA',
      status: 409,
    });
  }
}

class PacienteYaInternadoError extends DomainError {
  constructor(pacienteId) {
    super(`El paciente ${pacienteId} ya tiene una cama asignada.`, {
      code: 'PACIENTE_YA_INTERNADO',
      status: 409,
    });
  }
}

class PacienteSinCamaError extends DomainError {
  constructor(pacienteId) {
    super(`El paciente ${pacienteId} no tiene una cama asignada.`, {
      code: 'PACIENTE_SIN_CAMA',
      status: 409,
    });
  }
}

class CapacidadExcedidaError extends DomainError {
  constructor(numero, capacidad) {
    super(`La habitación ${numero} ya tiene ${capacidad} cama(s), su capacidad máxima.`, {
      code: 'CAPACIDAD_EXCEDIDA',
      status: 409,
    });
  }
}

class StockInsuficienteError extends DomainError {
  // Sin argumentos: lo detecto el CHECK de la base y no hay detalle.
  constructor(insumo, piso, disponible, pedido) {
    super(
      insumo
        ? `Stock insuficiente de ${insumo} en el piso ${piso}: hay ${disponible} y se pidieron ${pedido}.`
        : 'El stock no puede quedar negativo.',
      { code: 'STOCK_INSUFICIENTE', status: 409 }
    );
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
  CamaOcupadaError,
  CamaReservadaError,
  PacienteYaInternadoError,
  PacienteSinCamaError,
  CapacidadExcedidaError,
  StockInsuficienteError,
  NoEncontradoError,
  DatosInvalidosError,
};
