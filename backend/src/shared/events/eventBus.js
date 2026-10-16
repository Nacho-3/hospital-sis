const { EventEmitter } = require('node:events');

// Bus de eventos en memoria para la integracion asincrona entre modulos.
// Ejemplo: Atencion publica 'MedicacionAdministrada', Facturacion y Camas la escuchan.
// Los nombres y el formato de cada evento se acuerdan entre todos (ver CONTRIBUTING.md).
const eventBus = new EventEmitter();

module.exports = eventBus;
