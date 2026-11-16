const router = require('express').Router();
const pacientesService = require('../servicio/pacientesService');
const signosVitalesService = require('../servicio/signosVitalesService');
const administracionesService = require('../servicio/administracionesService');
const indicacionService = require('../servicio/indicacionService');
const notasService = require('../servicio/notasService');
const protocoloService = require('../servicio/protocoloService');
const avisosService = require('../servicio/avisosService');
const ah = (fn) => (req, res, next) => fn(req, res, next).catch(next);   // necesario en Express 4
const autenticar = require('../../identidad/middlewares/autenticar');
const requierePermiso = require('../../identidad/middlewares/requierePermiso');

protocoloService.registrarListeners();
avisosService.registrarListeners();

router.post('/signos-vitales', autenticar, requierePermiso('signos_vitales:registrar'), ah(async (req, res) => {
  const { pacienteId, camaId, presionSistolica, presionDiastolica, frecuenciaCardiaca, temperatura } = req.body;
  const r = await signosVitalesService.registrar({
    pacienteId, camaId, presionSistolica, presionDiastolica, frecuenciaCardiaca, temperatura,
    enfermeroId: req.usuario.id,                 // lo setea el middleware de autenticación
  });
  res.status(201).json(r);
}));

router.get('/pacientes/:pacienteId/signos-vitales', autenticar, requierePermiso('signos_vitales:ver'), ah(async (req, res) => {
  res.json(await signosVitalesService.listarPorPaciente(req.params.pacienteId));
}));

router.get('/pacientes/:pacienteId/notas', autenticar, requierePermiso('signos_vitales:ver'), ah(async (req, res) => {
  res.json(await notasService.listarPorPaciente(req.params.pacienteId));
}));

router.post('/notas', autenticar, requierePermiso('signos_vitales:registrar'), ah(async (req, res) => {
  const nota = await notasService.crear({ ...req.body, enfermeroId: req.usuario.id });
  res.status(201).json(nota);
}));

router.get('/pacientes/:pacienteId/protocolos', autenticar, requierePermiso('indicacion:ver'), ah(async (req, res) => {
  res.json(await protocoloService.listarPorPaciente(req.params.pacienteId));
}));

router.patch('/protocolo-tareas/:id/realizar', autenticar, requierePermiso('signos_vitales:registrar'), ah(async (req, res) => {
  res.json(await protocoloService.realizarTarea(req.params.id));
}));

router.post('/administraciones/:id/confirmar', autenticar, requierePermiso('medicacion:administrar'), ah(async (req, res) => {
  const r = await administracionesService.confirmar({
    administracionId: Number(req.params.id), enfermeroId: req.usuario.id,
  });
  res.json(r);
}));

router.get('/administraciones/pendientes', autenticar, requierePermiso('indicacion:ver'), ah(async (req, res) => {
  res.json(await administracionesService.listarPendientes(req.query.pacienteId));
}));

router.post('/indicaciones', autenticar, requierePermiso('indicacion:prescribir'), ah(async (req, res) => {
  const indicacion = await indicacionService.crear({ ...req.body, medicoId: req.usuario.id });
  res.status(201).json(indicacion);
}));

router.get('/avisos', autenticar, requierePermiso('triaje:ver'), ah(async (req, res) => {
  res.json(await avisosService.listarAbiertos());
}));

router.post('/avisos/:id/cerrar', autenticar, requierePermiso('triaje:ver'), ah(async (req, res) => {
  res.json(await avisosService.cerrar(req.params.id));
}));

router.get('/pacientes', autenticar, requierePermiso('signos_vitales:ver'), ah(async (req, res) => {
  res.json(await pacientesService.buscar(req.query.buscar));
}));

module.exports = router;