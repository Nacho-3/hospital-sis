const express = require('express');
const admision = require('../servicio/admisionServicio');

// Montadas en /api/admision desde app.js.
const router = express.Router();

// Express 4 no captura errores de funciones async: los pasamos a next()
// para que el middleware central responda el DomainError (409, 404, 400).
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

router.get('/pacientes', h(async (req, res) => {
  res.json(await admision.listarPacientes());
}));

router.post('/pacientes', h(async (req, res) => {
  res.status(201).json(await admision.registrarPaciente(req.body));
}));

router.get('/medicos', h(async (req, res) => {
  res.json(await admision.listarMedicos());
}));

router.get('/turnos', h(async (req, res) => {
  res.json(await admision.listarTurnos());
}));

router.post('/turnos', h(async (req, res) => {
  res.status(201).json(await admision.abrirTurno(req.body));
}));

// HU 1.1: { pacienteId }. 201 no: el turno ya existia. 200 con el turno programado.
router.post('/turnos/:id/reservar', h(async (req, res) => {
  res.json(await admision.reservar(req.params.id, req.body));
}));

// HU 1.2. 201: aparece un turno nuevo. El cuerpo trae el achicado y el entreturno.
router.post('/turnos/:id/entreturno', h(async (req, res) => {
  res.status(201).json(await admision.insertarEntreturno(req.params.id));
}));

router.get('/lista-espera', h(async (req, res) => {
  res.json(await admision.listarEspera());
}));

router.post('/lista-espera', h(async (req, res) => {
  res.status(201).json(await admision.anotarEnEspera(req.body));
}));

// HU 1.3. Cancelar puede devolver a quien hay que llamar, si habia cola ese dia.
router.post('/turnos/:id/cancelar', h(async (req, res) => {
  res.json(await admision.cancelar(req.params.id));
}));

module.exports = router;
