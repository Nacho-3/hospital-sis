const express = require('express');
const camas = require('../servicio/camasServicio');
const movimientos = require('../servicio/movimientosServicio');
const enVivo = require('./enVivo');
const { registrarSuscriptores } = require('../suscriptores');
const { PERMISOS, con, tokenDesdeQuery, autenticar } = require('./permisos');

// Rutas del modulo, montadas en /api/camas desde app.js.
// Al cargarlas se registran tambien los listeners de eventos de otros modulos.
// Todas las rutas piden usuario autenticado y el permiso de la matriz.
registrarSuscriptores();
const router = express.Router();

// Express 4 no captura errores de funciones async: los pasamos a next()
// para que los maneje el middleware central (DomainError -> status + JSON).
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// Mapa de camas. Filtros opcionales: ?piso=2&estado=disponible
router.get('/', con(PERMISOS.VER_MAPA), h(async (req, res) => {
  res.json(await camas.mapa(req.query));
}));

router.get('/habitaciones', con(PERMISOS.VER_MAPA), h(async (req, res) => {
  res.json(await camas.habitaciones());
}));

// La matriz no tiene un permiso para dar de alta habitaciones y camas:
// lo hace el administrativo de piso, con cama:asignar.
router.post('/habitaciones', con(PERMISOS.ASIGNAR), h(async (req, res) => {
  res.status(201).json(await camas.crearHabitacion(req.body));
}));

// Pacientes de Admision que hoy no tienen cama (para el selector de asignacion).
router.get('/pacientes-sin-cama', con(PERMISOS.ASIGNAR), h(async (req, res) => {
  res.json(await camas.pacientesSinCama());
}));

// Inventario de insumos por piso (HU 3.1). Va antes de /:id.
router.use('/inventario', require('./inventario'));

// Server-Sent Events para refrescar el mapa en tiempo real. Basta con estar
// autenticado: enVivo manda a cada usuario solo los eventos que puede ver.
router.get('/en-vivo', tokenDesdeQuery, autenticar, enVivo);

// Traslado atomico: { camaDestinoId, motivo? }
router.post('/pacientes/:pacienteId/trasladar', con(PERMISOS.ASIGNAR), h(async (req, res) => {
  res.json(await movimientos.trasladar(req.params.pacienteId, req.body));
}));

// Alta de cama: { codigo, habitacionId }
router.post('/', con(PERMISOS.ASIGNAR), h(async (req, res) => {
  res.status(201).json(await camas.crearCama(req.body));
}));

router.get('/:id', con(PERMISOS.VER_MAPA), h(async (req, res) => {
  res.json(await camas.detalle(req.params.id));
}));

router.get('/:id/historial', con(PERMISOS.VER_MAPA), h(async (req, res) => {
  res.json(await camas.historial(req.params.id));
}));

// HU 1.1: { pacienteId, motivo? }
router.post('/:id/asignar', con(PERMISOS.ASIGNAR), h(async (req, res) => {
  res.json(await camas.asignar(req.params.id, req.body));
}));

// { pacienteId }
router.post('/:id/reservar', con(PERMISOS.ASIGNAR), h(async (req, res) => {
  res.json(await camas.reservar(req.params.id, req.body));
}));

router.post('/:id/cancelar-reserva', con(PERMISOS.ASIGNAR), h(async (req, res) => {
  res.json(await camas.cancelarReserva(req.params.id));
}));

// Alta o egreso desde el mapa: { motivoEgreso? } (alta | traslado | otro).
// El alta clinica normal llega sola por el evento PacienteDadoDeAlta.
router.post('/:id/liberar', con(PERMISOS.ASIGNAR), h(async (req, res) => {
  res.json(await movimientos.liberar(req.params.id, req.body));
}));

// HU 2.1 escenario 2: maestranza confirma la higiene.
router.post('/:id/finalizar-limpieza', con(PERMISOS.CONFIRMAR_LIMPIEZA), h(async (req, res) => {
  res.json(await movimientos.finalizarLimpieza(req.params.id));
}));

// Mantenimiento: la matriz no tiene un permiso propio; lo maneja el
// administrativo de piso, con cama:asignar.
router.post('/:id/mantenimiento', con(PERMISOS.ASIGNAR), h(async (req, res) => {
  res.json(await movimientos.enviarAMantenimiento(req.params.id));
}));

router.post('/:id/finalizar-mantenimiento', con(PERMISOS.ASIGNAR), h(async (req, res) => {
  res.json(await movimientos.finalizarMantenimiento(req.params.id));
}));

module.exports = router;
