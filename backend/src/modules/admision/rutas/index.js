const express = require('express');
const admision = require('../servicio/admisionServicio');
const { PERMISOS: P, con, conAlguno } = require('./permisos');

// Montadas en /api/admision desde app.js.
const router = express.Router();

// Express 4 no captura errores de funciones async: los pasamos a next()
// para que el middleware central responda el DomainError (409, 404, 400).
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// Todas las rutas piden sesion de Identidad y el permiso de la matriz.
// Sin token: 401. Con token pero sin el permiso: 403.

// La lista de pacientes la usan todas las secciones de Admision:
// alcanza con cualquier permiso del modulo.
router.get('/pacientes', conAlguno(...Object.values(P)), h(async (req, res) => {
  res.json(await admision.listarPacientes());
}));

router.post('/pacientes', con(P.REGISTRAR_PACIENTE), h(async (req, res) => {
  res.status(201).json(await admision.registrarPaciente(req.body));
}));

router.get('/medicos', con(P.VER_AGENDA), h(async (req, res) => {
  res.json(await admision.listarMedicos());
}));

router.get('/turnos', con(P.VER_AGENDA), h(async (req, res) => {
  res.json(await admision.listarTurnos());
}));

// Abrir un turno libre en la agenda: la matriz no tiene un permiso propio;
// es tarea del coordinador de agendas, como el entreturno.
router.post('/turnos', con(P.ENTRETURNO), h(async (req, res) => {
  res.status(201).json(await admision.abrirTurno(req.body));
}));

// HU 1.1: { pacienteId }. 201 no: el turno ya existia. 200 con el turno programado.
router.post('/turnos/:id/reservar', con(P.RESERVAR), h(async (req, res) => {
  res.json(await admision.reservar(req.params.id, req.body));
}));

// HU 1.2. 201: aparece un turno nuevo. El cuerpo trae el achicado y el entreturno.
router.post('/turnos/:id/entreturno', con(P.ENTRETURNO), h(async (req, res) => {
  res.status(201).json(await admision.insertarEntreturno(req.params.id));
}));

router.get('/lista-espera', conAlguno(P.ESPERA, P.VER_AGENDA), h(async (req, res) => {
  res.json(await admision.listarEspera());
}));

router.post('/lista-espera', con(P.ESPERA), h(async (req, res) => {
  res.status(201).json(await admision.anotarEnEspera(req.body));
}));

// HU 1.3. Cancelar puede devolver a quien hay que llamar, si habia cola ese dia.
router.post('/turnos/:id/cancelar', con(P.CANCELAR), h(async (req, res) => {
  res.json(await admision.cancelar(req.params.id));
}));

// HU 2.1. Confirmar, llegar al mostrador y cerrar la consulta.
router.post('/turnos/:id/confirmar', con(P.CAMBIAR_ESTADO), h(async (req, res) => {
  res.json(await admision.confirmar(req.params.id));
}));

router.post('/turnos/:id/llegada', con(P.CAMBIAR_ESTADO), h(async (req, res) => {
  res.json(await admision.registrarLlegada(req.params.id));
}));

router.post('/turnos/:id/atender', con(P.CAMBIAR_ESTADO), h(async (req, res) => {
  res.json(await admision.atender(req.params.id));
}));

router.get('/enfermeros', con(P.REGISTRAR_TRIAJE), h(async (req, res) => {
  res.json(await admision.listarEnfermeros());
}));

router.get('/guardia', con(P.VER_TRIAJE), h(async (req, res) => {
  res.json(await admision.listarGuardia());
}));

// HU 3.1. 201: la persona entra a la cola. Si es rojo, el aviso va en el cuerpo.
router.post('/guardia', con(P.REGISTRAR_TRIAJE), h(async (req, res) => {
  res.status(201).json(await admision.clasificarGuardia(req.body));
}));

// Despues del COMMIT, Atencion recibe PacienteIngresado y arma el protocolo.
// El pase a observacion es un tramite de admision: lo hace la recepcion.
// La matriz no tiene un permiso propio; se usa el de registrar pacientes.
router.post('/observacion', con(P.REGISTRAR_PACIENTE), h(async (req, res) => {
  res.status(201).json(await admision.ingresarObservacion(req.body));
}));

module.exports = router;
