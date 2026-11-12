const { CoberturaInvalidaError } = require('./errores');
const { aCentavos, aPesos } = require('./dinero');

// Patron Strategy (HU 1.1). Cada tipo de cobertura decide cuanto de un cargo
// paga el paciente; el resto va a su financiador. Sumar un tipo nuevo es
// escribir una clase y registrarla en ESTRATEGIAS: el resto no se toca.
//
// Contrato de una estrategia:
//   financiador                          destinatario del resto, o null si no hay
//   aCargoDelPaciente(total, cobertura)  centavos que paga el paciente

const DESTINATARIOS = Object.freeze({
  PACIENTE: 'paciente',
  OBRA_SOCIAL: 'obra_social',
  ESTADO: 'estado',
});

// Un paciente sin cobertura vigente se factura como particular.
const COBERTURA_PARTICULAR = Object.freeze({
  id: null,
  nombre: 'Particular',
  tipo: 'particular',
  copago_fijo: null,
});

// Particular: el valor completo al paciente.
class EstrategiaParticular {
  financiador = null;

  aCargoDelPaciente(totalCentavos) {
    return totalCentavos;
  }
}

// Publica: el paciente no paga y todo queda a cargo del estado.
class EstrategiaPublica {
  financiador = DESTINATARIOS.ESTADO;

  aCargoDelPaciente() {
    return 0;
  }
}

// Prepaga: copago fijo al paciente (nunca mas que el total) y el resto a la obra social.
class EstrategiaPrepaga {
  financiador = DESTINATARIOS.OBRA_SOCIAL;

  aCargoDelPaciente(totalCentavos, cobertura) {
    const copago = cobertura.copago_fijo ?? 0;
    if (typeof copago !== 'number' || !Number.isFinite(copago) || copago < 0) {
      throw new CoberturaInvalidaError(
        `El copago fijo de ${cobertura.nombre} tiene que ser un numero mayor o igual a cero.`
      );
    }
    return Math.min(totalCentavos, aCentavos(copago));
  }
}

// Un Map y no un objeto: con un objeto, un tipo como "constructor" o
// "__proto__" encontraria una propiedad heredada en vez de fallar.
const ESTRATEGIAS = new Map([
  ['particular', new EstrategiaParticular()],
  ['publica', new EstrategiaPublica()],
  ['prepaga', new EstrategiaPrepaga()],
]);

// Reparte un monto entre el paciente y el financiador de su cobertura.
// Devuelve una parte por destinatario: { monto, destinatario, destinatarioNombre }.
// La parte del paciente va siempre, aunque sea de $0: la HU 1.1 pide que con
// cobertura publica quede registrado el cargo de 0 pesos a su nombre.
// La del financiador va solo si le queda algo por pagar.
function calcularDistribucionCargo({ montoTotal, cobertura, nombrePaciente = 'Paciente' }) {
  if (typeof montoTotal !== 'number' || !Number.isFinite(montoTotal) || montoTotal < 0) {
    throw new CoberturaInvalidaError('El monto a facturar tiene que ser un numero mayor o igual a cero.');
  }

  const coberturaEfectiva = cobertura ?? COBERTURA_PARTICULAR;
  const estrategia = ESTRATEGIAS.get(coberturaEfectiva.tipo);
  if (!estrategia) {
    throw new CoberturaInvalidaError(
      `Tipo de cobertura desconocido: "${coberturaEfectiva.tipo}". Valores permitidos: ${[...ESTRATEGIAS.keys()].join(', ')}.`
    );
  }

  const total = aCentavos(montoTotal);
  const paciente = estrategia.aCargoDelPaciente(total, coberturaEfectiva);

  const partes = [
    { centavos: paciente, destinatario: DESTINATARIOS.PACIENTE, destinatarioNombre: nombrePaciente },
    { centavos: total - paciente, destinatario: estrategia.financiador, destinatarioNombre: coberturaEfectiva.nombre },
  ];

  return partes
    .filter((parte) => parte.destinatario === DESTINATARIOS.PACIENTE || parte.centavos > 0)
    .map(({ centavos, destinatario, destinatarioNombre }) => ({
      monto: aPesos(centavos),
      destinatario,
      destinatarioNombre,
    }));
}

module.exports = {
  DESTINATARIOS,
  COBERTURA_PARTICULAR,
  EstrategiaParticular,
  EstrategiaPublica,
  EstrategiaPrepaga,
  calcularDistribucionCargo,
};
