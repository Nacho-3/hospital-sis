const pool = require('../../../shared/db/pool');
const repo = require('../repositorio/admisionRepositorio');
const { conTransaccion } = require('../repositorio/transaccion');
const { TransicionInvalidaError } = require('../../../shared/errors/DomainError');
const { TurnoOcupadoError, NoEncontradoError, DatosInvalidosError } = require('../dominio/errores');

const DURACION_PARTIBLE_MS = 30 * 60 * 1000;
const MITAD_MS = 15 * 60 * 1000;

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

// HU 1.2. El coordinador parte el turno de 30 minutos (10:00–10:30) en dos de 15.
// El corte queda en el medio: no se acepta otra hora, porque la historia es esa.
// Orden dentro de la misma transaccion:
//   1. FOR UPDATE. El otro coordinador espera y despues ve el turno ya achicado.
//   2. UPDATE del fin a las 10:15 y duracion_reducida. El paciente, si lo habia, se queda.
//   3. INSERT del entreturno 10:15–10:30, libre. El rango es [inicio, fin), asi que
//      se tocan en las 10:15 y no se pisan.
// Si se insertara antes de achicar, turnos_sin_solape rechazaria el hueco.
async function insertarEntreturno(turnoId) {
  const id = enteroPositivo(turnoId, 'turnoId');
  return conTransaccion(async (db) => {
    const turno = await repo.bloquearTurno(db, id);
    if (!turno) throw new NoEncontradoError('el turno', id);
    if (turno.estado !== 'disponible' && turno.estado !== 'programado') {
      throw new TransicionInvalidaError('Solo se puede achicar un turno disponible o programado.');
    }
    const inicio = new Date(turno.inicio);
    const fin = new Date(turno.fin);
    if (fin.getTime() - inicio.getTime() !== DURACION_PARTIBLE_MS) {
      throw new DatosInvalidosError('Solo se puede insertar un entreturno partiendo un turno de 30 minutos.');
    }
    const corte = new Date(inicio.getTime() + MITAD_MS).toISOString();
    if (!(await repo.achicarTurno(db, id, corte))) {
      throw new DatosInvalidosError('Solo se puede insertar un entreturno partiendo un turno de 30 minutos.');
    }
    const entreturno = await repo.crearEntreturno(db, {
      medicoId: turno.medico_id,
      inicio: corte,
      fin: fin.toISOString(),
    });
    return { turno: await repo.obtenerTurno(db, id), entreturno };
  });
}

module.exports = {
  listarPacientes,
  listarMedicos,
  listarTurnos,
  registrarPaciente,
  abrirTurno,
  reservar,
  insertarEntreturno,
};
