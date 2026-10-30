const eventBus = require('../../../shared/events/eventBus');
const { CAMA_ESTADO_CAMBIADO } = require('../dominio/eventos');

// Publica eventos despues del COMMIT, nunca adentro de la transaccion:
// si se publicara antes y la transaccion fallara, otro modulo reaccionaria
// a algo que no paso. Un listener que falla no rompe la operacion que ya se guardo.
function publicar(eventos) {
  for (const { nombre, carga } of eventos) {
    try {
      eventBus.emit(nombre, carga);
    } catch (err) {
      console.error(`[camas] Fallo un listener de ${nombre}:`, err);
    }
  }
}

function cambioDeEstado(cama, estadoAnterior) {
  return {
    nombre: CAMA_ESTADO_CAMBIADO,
    carga: {
      camaId: cama.id,
      codigoCama: cama.codigo,
      estadoAnterior,
      estadoNuevo: cama.nombreEstado,
    },
  };
}

module.exports = { publicar, cambioDeEstado };
