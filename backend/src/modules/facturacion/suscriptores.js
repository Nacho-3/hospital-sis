const eventBus = require('../../shared/events/eventBus');
const eventos = require('../../shared/events/eventos');
const facturacion = require('./servicio/facturacionServicio');

// Eventos de otros modulos que escucha Facturacion. Se registran una sola vez,
// cuando app.js carga las rutas del modulo.
//
// Un listener nunca lanza: el modulo que publico el evento ya guardo lo suyo
// y no tiene por que enterarse de un problema de Facturacion. Se loguea y listo.

function escuchar(nombre, manejador) {
  eventBus.on(nombre, (carga) => {
    Promise.resolve()
      .then(() => manejador(carga))
      .catch((err) => console.error(`[facturacion] No se pudo procesar ${nombre}:`, err.message, carga));
  });
}

let registrados = false;

function registrarSuscriptores() {
  if (registrados) return;
  registrados = true;

  // Atencion -> Facturacion: cargo automatico por el insumo administrado (HU 2.1).
  escuchar(eventos.MEDICACION_ADMINISTRADA, (carga) => facturacion.registrarCargoPorMedicacion(carga));
}

module.exports = { registrarSuscriptores };
