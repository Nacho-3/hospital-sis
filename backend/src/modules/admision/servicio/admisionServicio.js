const pool = require('../../../shared/db/pool');
const repo = require('../repositorio/admisionRepositorio');
const { conTransaccion } = require('../repositorio/transaccion');
const { TurnoOcupadoError, NoEncontradoError, DatosInvalidosError } = require('../dominio/errores');

function enteroPositivo(valor, campo) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) {
    throw new DatosInvalidosError(`${campo} tiene que ser un entero positivo.`);
  }
  return n;
}

function texto(valor, campo, { opcional = false, max = 80 } = {}) {
  if (valor === undefined || valor === null || String(valor).trim() === '') {
    if (opcional) return null;
    throw new DatosInvalidosError(`Falta ${campo}.`);
  }
  const t = String(valor).trim();
  if (t.length > max) throw new DatosInvalidosError(`${campo} admite hasta ${max} caracteres.`);
  return t;
}

function instante(valor, campo) {
  const fecha = new Date(valor);
  if (!valor || Number.isNaN(fecha.getTime())) {
    throw new DatosInvalidosError(`${campo} no es una fecha válida.`);
  }
  return fecha.toISOString();
}

function listarPacientes() {
  return repo.listarPacientes(pool);
}

function listarMedicos() {
  return repo.listarMedicos(pool);
}

function listarTurnos() {
  return repo.listarTurnos(pool);
}

// El "dado que el paciente está registrado" de la HU 1.1.
// No es la historia: sin esta fila no hay a quien asignarle el turno.
async function registrarPaciente({ nombre, apellido, documento } = {}) {
  const datos = {
    nombre: texto(nombre, 'nombre'),
    apellido: texto(apellido, 'apellido'),
    documento: texto(documento, 'documento', { opcional: true, max: 32 }),
  };
  return conTransaccion((db) => repo.crearPaciente(db, datos));
}

// El "dado que el turno de las 10:00 está disponible".
// Nace libre, sin paciente. La reserva es otra operacion.
async function abrirTurno({ medicoId, inicio, fin } = {}) {
  const medico = enteroPositivo(medicoId, 'medicoId');
  const desde = instante(inicio, 'inicio');
  const hasta = instante(fin, 'fin');
  if (new Date(hasta) <= new Date(desde)) {
    throw new DatosInvalidosError('El turno tiene que terminar después de empezar.');
  }
  return conTransaccion((db) => repo.crearTurno(db, { medicoId: medico, inicio: desde, fin: hasta }));
}

// HU 1.1. Dos recepcionistas pueden apretar Reservar en el mismo milisegundo.
// La base las ordena asi:
//   1. BEGIN.
//   2. SELECT ... FOR UPDATE traba esa fila. La segunda espera en este punto
//      y no lee el turno como estaba antes.
//   3. Cuando entra, mira el estado. Si ya no es 'disponible', la primera
//      lo tomo: se rechaza con 409 y se hace ROLLBACK.
//   4. Si sigue libre, pasa a 'programado' con ese paciente y se hace COMMIT.
//      Recien ahi la segunda puede leer la fila.
async function reservar(turnoId, { pacienteId } = {}) {
  const id = enteroPositivo(turnoId, 'turnoId');
  const paciente = enteroPositivo(pacienteId, 'pacienteId');
  return conTransaccion(async (db) => {
    const turno = await repo.bloquearTurno(db, id);
    if (!turno) throw new NoEncontradoError('el turno', id);
    if (!(await repo.existePaciente(db, paciente))) {
      throw new NoEncontradoError('el paciente', paciente);
    }
    if (turno.estado !== 'disponible' || !(await repo.marcarProgramado(db, id, paciente))) {
      throw new TurnoOcupadoError();
    }
    return repo.obtenerTurno(db, id);
  });
}

module.exports = {
  listarPacientes,
  listarMedicos,
  listarTurnos,
  registrarPaciente,
  abrirTurno,
  reservar,
};
