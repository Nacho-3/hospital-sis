const eventBus = require('../../../shared/events/eventBus');

// Despues del COMMIT. Si se publicara adentro y la transaccion fallara,
// Atencion veria un paciente en sala que no quedo guardado.
function publicar(eventos) {
  for (const { nombre, carga } of eventos) {
    try {
      eventBus.emit(nombre, carga);
    } catch (err) {
      console.error(`[admision] Fallo un listener de ${nombre}:`, err);
    }
  }
}

module.exports = { publicar };
