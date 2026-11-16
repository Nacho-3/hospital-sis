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

// HU 2.1. Confirmar, llegar al mostrador y cerrar la consulta.
router.post('/turnos/:id/confirmar', h(async (req, res) => {
  res.json(await admision.confirmar(req.params.id));
}));

router.post('/turnos/:id/llegada', h(async (req, res) => {
  res.json(await admision.registrarLlegada(req.params.id));
}));

router.post('/turnos/:id/atender', h(async (req, res) => {
  res.json(await admision.atender(req.params.id));
}));

router.get('/enfermeros', h(async (req, res) => {
  res.json(await admision.listarEnfermeros());
}));

router.get('/guardia', h(async (req, res) => {
  res.json(await admision.listarGuardia());
}));

// HU 3.1. 201: la persona entra a la cola. Si es rojo, el aviso va en el cuerpo.
router.post('/guardia', h(async (req, res) => {
  res.status(201).json(await admision.clasificarGuardia(req.body));
}));

// Despues del COMMIT, Atencion recibe PacienteIngresado y arma el protocolo.
router.post('/observacion', h(async (req, res) => {
  res.status(201).json(await admision.ingresarObservacion(req.body));
}));

module.exports = router;
