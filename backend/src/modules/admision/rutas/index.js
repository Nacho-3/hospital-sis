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

module.exports = router;
