const express = require('express');
const camas = require('../servicio/camasServicio');

// Rutas del modulo, montadas en /api/camas desde app.js.
const router = express.Router();

// Express 4 no captura errores de funciones async: los pasamos a next()
// para que los maneje el middleware central (DomainError -> status + JSON).
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// Mapa de camas. Filtros opcionales: ?piso=2&estado=disponible
router.get('/', h(async (req, res) => {
  res.json(await camas.mapa(req.query));
}));

router.get('/habitaciones', h(async (req, res) => {
  res.json(await camas.habitaciones());
}));

router.post('/habitaciones', h(async (req, res) => {
  res.status(201).json(await camas.crearHabitacion(req.body));
}));

// Pacientes de Admision que hoy no tienen cama (para el selector del front).
router.get('/pacientes-sin-cama', h(async (req, res) => {
  res.json(await camas.pacientesSinCama());
}));

// Alta de cama: { codigo, habitacionId }
router.post('/', h(async (req, res) => {
  res.status(201).json(await camas.crearCama(req.body));
}));

router.get('/:id', h(async (req, res) => {
  res.json(await camas.detalle(req.params.id));
}));

router.get('/:id/historial', h(async (req, res) => {
  res.json(await camas.historial(req.params.id));
}));

// HU 1.1: { pacienteId, motivo? }
router.post('/:id/asignar', h(async (req, res) => {
  res.json(await camas.asignar(req.params.id, req.body));
}));

// { pacienteId }
router.post('/:id/reservar', h(async (req, res) => {
  res.json(await camas.reservar(req.params.id, req.body));
}));

router.post('/:id/cancelar-reserva', h(async (req, res) => {
  res.json(await camas.cancelarReserva(req.params.id));
}));

module.exports = router;
