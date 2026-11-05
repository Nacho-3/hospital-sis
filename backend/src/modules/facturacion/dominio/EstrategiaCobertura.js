const { DomainError } = require('../../../shared/errors/DomainError');

class CoberturaInvalidaError extends DomainError {
  constructor(message) {
    super(message, { code: 'COBERTURA_INVALIDA', status: 422 });
  }
}

function redondearMonto(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

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


class EstrategiaPrepaga {
  calcular(montoTotal, cobertura, nombrePaciente = 'Paciente') {
    const total = redondearMonto(montoTotal);
    const copagoConfigurado = Number(cobertura.copago_fijo ?? cobertura.copagoFijo ?? 0);

    if (Number.isNaN(copagoConfigurado) || copagoConfigurado < 0) {
      throw new CoberturaInvalidaError('El copago fijo de la prepaga no puede ser negativo.');
    }

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

const ESTRATEGIAS = {
  particular: new EstrategiaParticular(),
  publica: new EstrategiaPublica(),
  prepaga: new EstrategiaPrepaga(),
};

function calcularDistribucionCargo({ montoTotal, cobertura, nombrePaciente = 'Paciente' }) {
  const montoNumerico = Number(montoTotal);
  if (Number.isNaN(montoNumerico) || montoNumerico < 0) {
    throw new CoberturaInvalidaError('El monto a facturar debe ser un numero mayor o igual a cero.');
  }

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