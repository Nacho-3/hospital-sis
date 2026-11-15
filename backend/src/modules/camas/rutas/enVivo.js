const { EventEmitter } = require('node:events');
const eventBus = require('../../../shared/events/eventBus');
const eventosCamas = require('../dominio/eventos');
const { PermisoDenegadoError } = require('../../identidad/dominio/errores');
const { PERMISOS, tiene } = require('./permisos');

// Canal en vivo para los monitores de administracion (HU 2.1):
// Server-Sent Events. El front abre un EventSource a /api/camas/en-vivo y
// recibe un mensaje cada vez que el modulo publica uno de sus eventos.
//
// Se escucha el eventBus compartido una sola vez y se reparte a los clientes
// desde un emisor propio, para no colgar un listener por pantalla abierta
// en el bus de todos.
const canal = new EventEmitter();
canal.setMaxListeners(0);

for (const nombre of Object.values(eventosCamas)) {
  eventBus.on(nombre, (carga) => canal.emit('mensaje', nombre, carga));
}

// Que permiso hace falta para recibir cada evento. Las alertas de stock son
// del gestor de inventario; el resto, de quien ve el mapa de camas.
function permisoDelEvento(nombre) {
  return nombre === eventosCamas.STOCK_BAJO_DETECTADO
    ? PERMISOS.VER_INVENTARIO
    : PERMISOS.VER_MAPA;
}

// Corre despues de autenticar: req.usuario ya esta cargado.
function enVivo(req, res) {
  const puedeMapa = tiene(req, PERMISOS.VER_MAPA);
  const puedeInventario = tiene(req, PERMISOS.VER_INVENTARIO);
  if (!puedeMapa && !puedeInventario) {
    throw new PermisoDenegadoError();
  }

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();
  res.write('retry: 3000\n\n');

  const enviar = (nombre, carga) => {
    if (!tiene(req, permisoDelEvento(nombre))) return;
    res.write(`event: ${nombre}\ndata: ${JSON.stringify(carga)}\n\n`);
  };
  canal.on('mensaje', enviar);

  // Mantiene viva la conexion a traves de proxies.
  const latido = setInterval(() => res.write(': latido\n\n'), 25000);

  req.on('close', () => {
    clearInterval(latido);
    canal.off('mensaje', enviar);
  });
}

module.exports = enVivo;
