const { DomainError } = require('../../../shared/errors/DomainError');

/**
 * Error especifico cuando una cobertura o monto no cumple las reglas de facturacion.
 */
class CoberturaInvalidaError extends DomainError {
  constructor(message) {
    super(message, { code: 'COBERTURA_INVALIDA', status: 422 });
  }
}

/**
 * Redondea a 2 decimales para evitar problemas de punto flotante en montos financieros
 * y coincidir con NUMERIC(12, 2) de PostgreSQL.
 */
function redondearMonto(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

/**
 * Estrategia 1: Cobertura Particular
 * El valor base completo queda a cargo del paciente.
 */
class EstrategiaParticular {
  calcular(montoTotal, cobertura, nombrePaciente = 'Paciente') {
    const total = redondearMonto(montoTotal);
    return [
      {
        monto: total,
        destinatario: 'paciente',
        destinatarioNombre: nombrePaciente,
      },
    ];
  }
}

/**
 * Estrategia 2: Cobertura Publica
 * El paciente paga 0 y el 100% del cargo queda a cargo del Estado.
 */
class EstrategiaPublica {
  calcular(montoTotal, cobertura, nombrePaciente = 'Paciente') {
    const total = redondearMonto(montoTotal);
    return [
      {
        monto: 0,
        destinatario: 'paciente',
        destinatarioNombre: nombrePaciente,
      },
      {
        monto: total,
        destinatario: 'estado',
        destinatarioNombre: cobertura.nombre || 'Estado',
      },
    ];
  }
}

/**
 * Estrategia 3: Cobertura Prepaga / Obra Social
 * El paciente abona un copago fijo (hasta el tope del valor total)
 * y la diferencia queda a cargo de la obra social/prepaga.
 */
class EstrategiaPrepaga {
  calcular(montoTotal, cobertura, nombrePaciente = 'Paciente') {
    const total = redondearMonto(montoTotal);
    const copagoConfigurado = Number(cobertura.copago_fijo ?? cobertura.copagoFijo ?? 0);

    if (Number.isNaN(copagoConfigurado) || copagoConfigurado < 0) {
      throw new CoberturaInvalidaError('El copago fijo de la prepaga no puede ser negativo.');
    }

    // Si el insumo o practica cuesta menos que el copago fijo, el paciente paga solo el total
    const montoPaciente = redondearMonto(Math.min(total, copagoConfigurado));
    const montoObraSocial = redondearMonto(total - montoPaciente);

    const distribucion = [];

    if (montoPaciente > 0) {
      distribucion.push({
        monto: montoPaciente,
        destinatario: 'paciente',
        destinatarioNombre: nombrePaciente,
      });
    }

    if (montoObraSocial > 0) {
      distribucion.push({
        monto: montoObraSocial,
        destinatario: 'obra_social',
        destinatarioNombre: cobertura.nombre,
      });
    }

    // Caso borde: si el monto total de la practica fuera 0
    if (distribucion.length === 0) {
      distribucion.push({
        monto: 0,
        destinatario: 'obra_social',
        destinatarioNombre: cobertura.nombre,
      });
    }

    return distribucion;
  }
}

// Mapa de estrategias disponibles segun el CHECK de la tabla coberturas
const ESTRATEGIAS = {
  particular: new EstrategiaParticular(),
  publica: new EstrategiaPublica(),
  prepaga: new EstrategiaPrepaga(),
};

/**
 * Contexto / Selector del Patron Strategy:
 * Recibe los datos del cargo y la cobertura del paciente, valida las entradas
 * y delega el calculo financiero en la estrategia correspondiente.
 */
function calcularDistribucionCargo({ montoTotal, cobertura, nombrePaciente = 'Paciente' }) {
  const montoNumerico = Number(montoTotal);
  if (Number.isNaN(montoNumerico) || montoNumerico < 0) {
    throw new CoberturaInvalidaError('El monto a facturar debe ser un numero mayor o igual a cero.');
  }

  // Si el paciente no tiene cobertura registrada, se factura como particular por defecto
  const coberturaEfectiva = cobertura || { tipo: 'particular', nombre: 'Particular' };
  const estrategia = ESTRATEGIAS[coberturaEfectiva.tipo];

  if (!estrategia) {
    throw new CoberturaInvalidaError(
      `Tipo de cobertura desconocido: "${coberturaEfectiva.tipo}". Valores permitidos: publica, prepaga, particular.`
    );
  }

  return estrategia.calcular(montoNumerico, coberturaEfectiva, nombrePaciente);
}

module.exports = {
  CoberturaInvalidaError,
  EstrategiaParticular,
  EstrategiaPublica,
  EstrategiaPrepaga,
  calcularDistribucionCargo,
};