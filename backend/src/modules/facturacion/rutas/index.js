const express = require('express');
const facturacion = require('../servicio/facturacionServicio');
const { registrarSuscriptores } = require('../suscriptores');
const { PERMISOS: P, con } = require('./permisos');

// Rutas del modulo, montadas en /api/facturacion desde app.js.
// Al cargarlas se registran tambien los listeners de eventos de otros modulos.
// Aca no hay SQL ni reglas: cada ruta llama al servicio y devuelve su resultado.
registrarSuscriptores();
const router = express.Router();

// Express 4 no captura errores de funciones async: los pasamos a next()
// para que los maneje el middleware central (DomainError -> status + JSON).
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// Consultar pide cuenta_paciente:ver; cambiar la cobertura o facturar pide
// facturacion:calcular. Sin token: 401. Sin el permiso: 403.

router.get('/health', (req, res) => {
  res.json({ modulo: 'facturacion', status: 'activo' });
});

// Pacientes por nombre y apellido: ?q=ana rojas
router.get('/pacientes', con(P.VER_CUENTA), h(async (req, res) => {
  res.json(await facturacion.buscarPacientes(req.query.q));
}));

// Catalogo de coberturas (para el selector del front).
router.get('/coberturas', con(P.VER_CUENTA), h(async (req, res) => {
  res.json(await facturacion.coberturas());
}));

// Prestaciones facturables (nomenclador) con su valor base.
router.get('/nomenclador', con(P.VER_CUENTA), h(async (req, res) => {
  res.json(await facturacion.nomenclador());
}));

// Precio vigente de cada insumo.
router.get('/precios-insumo', con(P.VER_CUENTA), h(async (req, res) => {
  res.json(await facturacion.preciosVigentes());
}));

// Cobertura vigente del paciente. Sin cobertura responde la particular.
router.get('/cobertura/:pacienteId', con(P.VER_CUENTA), h(async (req, res) => {
  res.json(await facturacion.coberturaDePaciente(req.params.pacienteId));
}));

// Cambia la cobertura vigente: { coberturaId } (null = particular).
router.put('/cobertura/:pacienteId', con(P.CALCULAR), h(async (req, res) => {
  res.json(await facturacion.asignarCobertura(req.params.pacienteId, req.body));
}));

// Cuenta activa con cargos y totales.
router.get('/cuenta/:pacienteId', con(P.VER_CUENTA), h(async (req, res) => {
  res.json(await facturacion.cuentaDePaciente(req.params.pacienteId));
}));

// Cargo manual: { concepto, monto }. Responde los cargos que genero (uno por destinatario).
router.post('/cuenta/:pacienteId/cargos', con(P.CALCULAR), h(async (req, res) => {
  res.status(201).json(await facturacion.registrarCargoManual(req.params.pacienteId, req.body));
}));

// Factura una prestacion del nomenclador (HU 1.1): { nomencladorId }.
// Responde los cargos que genero (uno por destinatario).
router.post('/cuenta/:pacienteId/prestaciones', con(P.CALCULAR), h(async (req, res) => {
  res.status(201).json(await facturacion.registrarCargoPorPrestacion(req.params.pacienteId, req.body));
}));

// Solo fuera de produccion: publica eventos de prueba (ver simulacion.js).
if (process.env.NODE_ENV !== 'production') {
  router.use('/simulacion', con(P.CALCULAR), require('./simulacion'));
}

module.exports = router;
