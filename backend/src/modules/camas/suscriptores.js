const eventBus = require('../../shared/events/eventBus');
const eventos = require('../../shared/events/eventos');
const movimientos = require('./servicio/movimientosServicio');

// Eventos de otros modulos que escucha Camas. Se registran una sola vez,
// cuando app.js carga las rutas del modulo.
//
// Un listener nunca lanza: el modulo que publico el evento ya guardo lo suyo
// y no tiene por que enterarse de un problema de Camas. Se loguea y listo.

function escuchar(nombre, manejador) {
  eventBus.on(nombre, (carga) => {
    Promise.resolve()
      .then(() => manejador(carga))
      .catch((err) => console.error(`[camas] No se pudo procesar ${nombre}:`, err.message, carga));
  });
}

let registrados = false;

function registrarSuscriptores() {
  if (registrados) return;
  registrados = true;

  // Atencion -> Camas: la cama del paciente pasa a en_limpieza (HU 2.1 escenario 1).
  escuchar(eventos.PACIENTE_DADO_DE_ALTA, (carga) => movimientos.liberarPorAlta(carga));
}

module.exports = { registrarSuscriptores, escuchar };
