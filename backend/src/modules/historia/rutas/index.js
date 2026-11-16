const express = require('express');
const { autenticar, requierePermiso } = require('../../identidad');
const historia = require('../servicio/historiaServicio');

// Rutas de la Historia Clinica, montadas en /api/historia desde app.js.
// Todas piden usuario autenticado y el permiso que corresponde.
const router = express.Router();
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
const con = (permiso) => [autenticar, requierePermiso(permiso)];

const VER = 'historia:ver';
const REGISTRAR = 'historia:registrar';
const EVOLUCIONAR = 'historia:evolucionar';
const RECTIFICAR = 'historia:rectificar';

// Buscador de pacientes: ?buscar=texto (nombre, apellido o documento)
router.get('/pacientes', con(VER), h(async (req, res) => {
  res.json(await historia.buscarPacientes(req.query.buscar));
}));

// Cabecera de la historia: ficha, alergias vigentes, internacion actual…
router.get('/pacientes/:id', con(VER), h(async (req, res) => {
  res.json(await historia.resumen(req.params.id));
}));

router.get('/pacientes/:id/linea-de-tiempo', con(VER), h(async (req, res) => {
  res.json(await historia.lineaDeTiempo(req.params.id));
}));

router.get('/pacientes/:id/alergias', con(VER), h(async (req, res) => {
  res.json(await historia.alergias(req.params.id));
}));

// { sustancia, reaccion?, severidad: leve | moderada | grave }
router.post('/pacientes/:id/alergias', con(REGISTRAR), h(async (req, res) => {
  res.status(201).json(await historia.registrarAlergia(req.params.id, req.usuario.id, req.body));
}));

router.get('/pacientes/:id/antecedentes', con(VER), h(async (req, res) => {
  res.json(await historia.antecedentes(req.params.id));
}));

// { tipo: familiar | personal | quirurgico, descripcion, parentesco? }
router.post('/pacientes/:id/antecedentes', con(REGISTRAR), h(async (req, res) => {
  res.status(201).json(await historia.registrarAntecedente(req.params.id, req.usuario.id, req.body));
}));

router.get('/pacientes/:id/evoluciones', con(VER), h(async (req, res) => {
  res.json(await historia.evoluciones(req.params.id));
}));

// { texto, motivo?, diagnostico? }
router.post('/pacientes/:id/evoluciones', con(EVOLUCIONAR), h(async (req, res) => {
  res.status(201).json(await historia.registrarEvolucion(req.params.id, req.usuario.id, req.body));
}));

router.get('/pacientes/:id/estudios', con(VER), h(async (req, res) => {
  res.json(await historia.estudios(req.params.id));
}));

// { tipo: laboratorio | imagen | otro, nombre, realizadoEl: AAAA-MM-DD, resultado, enlace? }
router.post('/pacientes/:id/estudios', con(REGISTRAR), h(async (req, res) => {
  res.status(201).json(await historia.registrarEstudio(req.params.id, req.usuario.id, req.body));
}));

// { entidad: alergia | antecedente | evolucion | estudio, registroId, motivo }
router.post('/pacientes/:id/rectificaciones', con(RECTIFICAR), h(async (req, res) => {
  res.status(201).json(await historia.rectificar(req.params.id, req.usuario.id, req.body));
}));

module.exports = router;
