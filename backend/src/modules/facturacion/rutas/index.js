const express = require('express');
const facturacion = require('../servicio/facturacionServicio');
const { registrarSuscriptores } = require('../suscriptores');

// Rutas del modulo, montadas en /api/facturacion desde app.js.
// Al cargarlas se registran tambien los listeners de eventos de otros modulos.
// Aca no hay SQL ni reglas: cada ruta llama al servicio y devuelve su resultado.
registrarSuscriptores();
const router = express.Router();

// Express 4 no captura errores de funciones async: los pasamos a next()
// para que los maneje el middleware central (DomainError -> status + JSON).
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

router.get('/health', (req, res) => {
  res.json({ modulo: 'facturacion', status: 'activo' });
});

// Catalogo de coberturas (para el selector del front).
router.get('/coberturas', h(async (req, res) => {
  res.json(await facturacion.coberturas());
}));

// Prestaciones facturables (nomenclador) con su valor base.
router.get('/nomenclador', h(async (req, res) => {
  res.json(await facturacion.nomenclador());
}));

// Precio vigente de cada insumo.
router.get('/precios-insumo', h(async (req, res) => {
  res.json(await facturacion.preciosVigentes());
}));

// Cobertura vigente del paciente. Sin cobertura responde la particular.
router.get('/cobertura/:pacienteId', h(async (req, res) => {
  res.json(await facturacion.coberturaDePaciente(req.params.pacienteId));
}));

// Cambia la cobertura vigente: { coberturaId } (null = particular).
router.put('/cobertura/:pacienteId', h(async (req, res) => {
  res.json(await facturacion.asignarCobertura(req.params.pacienteId, req.body));
}));

// Cuenta activa con cargos y totales.
router.get('/cuenta/:pacienteId', h(async (req, res) => {
  res.json(await facturacion.cuentaDePaciente(req.params.pacienteId));
}));

// Cargo manual: { concepto, monto }. Responde los cargos que genero (uno por destinatario).
router.post('/cuenta/:pacienteId/cargos', h(async (req, res) => {
  res.status(201).json(await facturacion.registrarCargoManual(req.params.pacienteId, req.body));
}));

// Factura una prestacion del nomenclador (HU 1.1): { nomencladorId }.
// Responde los cargos que genero (uno por destinatario).
router.post('/cuenta/:pacienteId/prestaciones', h(async (req, res) => {
  res.status(201).json(await facturacion.registrarCargoPorPrestacion(req.params.pacienteId, req.body));
}));

// Solo fuera de produccion: publica eventos de prueba (ver simulacion.js).
if (process.env.NODE_ENV !== 'production') {
  router.use('/simulacion', require('./simulacion'));
}

module.exports = router;
