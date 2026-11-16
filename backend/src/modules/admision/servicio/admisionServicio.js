const pool = require('../../../shared/db/pool');
const repo = require('../repositorio/admisionRepositorio');
const { conTransaccion } = require('../repositorio/transaccion');
const { TransicionInvalidaError } = require('../../../shared/errors/DomainError');
const { TurnoOcupadoError, NoEncontradoError, DatosInvalidosError } = require('../dominio/errores');
const Turno = require('../dominio/Turno');
const { publicar } = require('./publicar');
const EVENTOS = require('../../../shared/events/eventos');

const PRIORIDAD = { rojo: 1, naranja: 2, amarillo: 3, verde: 4, azul: 5 };
const TIPOS_INGRESO = new Set(['pre_quirurgico', 'infeccion_respiratoria']);
const DURACION_PARTIBLE_MS = 30 * 60 * 1000;
const MITAD_MS = 15 * 60 * 1000;
const ZONA = 'America/Argentina/Buenos_Aires';

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

function fechaDia(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw new DatosInvalidosError('La fecha tiene que tener formato AAAA-MM-DD.');
  }
  const [anio, mes, dia] = valor.split('-').map(Number);
  const comprobacion = new Date(Date.UTC(anio, mes - 1, dia));
  if (
    comprobacion.getUTCFullYear() !== anio
    || comprobacion.getUTCMonth() !== mes - 1
    || comprobacion.getUTCDate() !== dia
  ) {
    throw new DatosInvalidosError('La fecha no existe.');
  }
  return valor;
}

// El dia del hospital es el calendario de Argentina. 11:00 de aca no es el dia UTC.
function fechaEnArgentina(valor) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(valor));
}

function horaEnArgentina(valor) {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: ZONA,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(valor));
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

function listarEspera() {
  return repo.listarEspera(pool);
}

function listarEnfermeros() {
  return repo.listarEnfermeros(pool);
}

function listarGuardia() {
  return repo.listarGuardia(pool);
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
    const dominio = Turno.desdeFila(turno);
    dominio.reservar();
    if (!(await repo.marcarProgramado(db, id, paciente))) {
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

// HU 1.3. Anotar en la cola de un medico y un dia. La posicion la calcula
// la transaccion, con un lock de esa cola, para que dos altas no ocupen el mismo lugar.
async function anotarEnEspera({ pacienteId, medicoId, fecha } = {}) {
  const paciente = enteroPositivo(pacienteId, 'pacienteId');
  const medico = enteroPositivo(medicoId, 'medicoId');
  const dia = fechaDia(fecha);
  return conTransaccion(async (db) => {
    if (!(await repo.existePaciente(db, paciente))) {
      throw new NoEncontradoError('el paciente', paciente);
    }
    if (!(await repo.existeMedico(db, medico))) {
      throw new NoEncontradoError('el médico', medico);
    }
    return repo.encolar(db, { pacienteId: paciente, medicoId: medico, fecha: dia });
  });
}

// HU 1.3. Cancelar es el disparador. En la misma transaccion:
//   1. FOR UPDATE del turno. Si ya no se puede cancelar, se rechaza.
//   2. Pasa a cancelado. El paciente original se queda en esa fila.
//   3. Se toma la menor posicion en_espera de ese medico y ese dia.
//   4. Se abre un turno nuevo, programado, en el mismo horario, para esa persona.
// El insert va despues del update: recien ahi el cancelado deja de ocupar el rango.
// Si no hay nadie en la cola, el turno queda cancelado y no hay a quien llamar.
async function cancelar(turnoId) {
  const id = enteroPositivo(turnoId, 'turnoId');
  return conTransaccion(async (db) => {
    const turno = await repo.bloquearTurno(db, id);
    if (!turno) throw new NoEncontradoError('el turno', id);
    Turno.desdeFila(turno).cancelar();
    if (!(await repo.marcarCancelado(db, id))) {
      throw new TransicionInvalidaError('Solo se puede cancelar un turno programado o confirmado.');
    }
    const cancelado = await repo.obtenerTurno(db, id);
    const espera = await repo.tomarPrimeroEnEspera(db, turno.medico_id, fechaEnArgentina(turno.inicio));
    if (!espera) return { turno: cancelado, asignado: null };
    const nuevo = await repo.crearTurnoAsignado(db, {
      medicoId: turno.medico_id,
      pacienteId: espera.paciente_id,
      inicio: new Date(turno.inicio).toISOString(),
      fin: new Date(turno.fin).toISOString(),
      esEntreturno: turno.es_entreturno,
      duracionReducida: turno.duracion_reducida,
    });
    if (!(await repo.marcarEsperaAsignada(db, espera.id, nuevo.id))) {
      throw new TransicionInvalidaError('Esa persona ya no estaba primera en la lista.');
    }
    const apellido = nuevo.paciente_apellido;
    const nombre = nuevo.paciente_nombre;
    return {
      turno: cancelado,
      asignado: {
        turno: nuevo,
        aviso: `Llamá a ${apellido}, ${nombre}: quedó en el turno de las ${horaEnArgentina(nuevo.inicio)}.`,
      },
    };
  });
}

// Aplica la operacion del patron State y persiste solo si la fila sigue
// en el estado que se leyo. El FOR UPDATE ya ordeno a la otra transaccion.
async function transicionar(turnoId, operacion) {
  const id = enteroPositivo(turnoId, 'turnoId');
  return conTransaccion(async (db) => {
    const fila = await repo.bloquearTurno(db, id);
    if (!fila) throw new NoEncontradoError('el turno', id);
    const dominio = Turno.desdeFila(fila);
    const desde = dominio.nombreEstado;
    dominio[operacion]();
    if (!(await repo.cambiarEstado(db, id, desde, dominio.nombreEstado))) {
      throw new TransicionInvalidaError(`No se pudo pasar el turno a ${dominio.nombreEstado}.`);
    }
    return repo.obtenerTurno(db, id);
  });
}

function confirmar(turnoId) {
  return transicionar(turnoId, 'confirmar');
}

// HU 2.1. El paciente llega al mostrador. El evento sale despues del COMMIT:
// Atencion no tiene que enterarse de una llegada que despues se revirtio.
async function registrarLlegada(turnoId) {
  const turno = await transicionar(turnoId, 'recibir');
  publicar([{
    nombre: EVENTOS.TURNO_EN_SALA_DE_ESPERA,
    carga: {
      turnoId: turno.id,
      pacienteId: turno.paciente_id,
      medicoId: turno.medico_id,
    },
  }]);
  return turno;
}

function atender(turnoId) {
  return transicionar(turnoId, 'atender');
}

// HU 3.1. Quien llega sin turno entra a la guardia segun el riesgo.
// Un codigo rojo se ubica delante del primer paciente menos urgente y,
// recien despues del COMMIT, avisa a Atencion.
async function clasificarGuardia({ pacienteId, enfermeroId, nivel } = {}) {
  const paciente = enteroPositivo(pacienteId, 'pacienteId');
  const enfermero = enteroPositivo(enfermeroId, 'enfermeroId');
  if (!Object.prototype.hasOwnProperty.call(PRIORIDAD, nivel)) {
    throw new DatosInvalidosError('El nivel de triaje no es válido.');
  }
  const ingreso = await conTransaccion(async (db) => {
    if (!(await repo.existePaciente(db, paciente))) {
      throw new NoEncontradoError('el paciente', paciente);
    }
    if (!(await repo.existeEnfermero(db, enfermero))) {
      throw new NoEncontradoError('el enfermero', enfermero);
    }
    return repo.encolarGuardia(db, {
      pacienteId: paciente,
      enfermeroId: enfermero,
      nivel,
      prioridad: PRIORIDAD[nivel],
    });
  });
  if (nivel !== 'rojo') return { ingreso, aviso: null };
  publicar([{
    nombre: EVENTOS.TRIAJE_RIESGO_VITAL,
    carga: { pacienteId: ingreso.paciente_id, nivel: 'rojo' },
  }]);
  return {
    ingreso,
    aviso: `Código Rojo: ${ingreso.paciente_apellido}, ${ingreso.paciente_nombre} entró en la guardia. Avisá a los médicos disponibles.`,
  };
}

// El protocolo no se arma aca. Atencion lo construye al recibir el evento,
// y el evento sale despues del COMMIT.
async function ingresarObservacion({ pacienteId, tipoIngreso } = {}) {
  const paciente = enteroPositivo(pacienteId, 'pacienteId');
  if (!TIPOS_INGRESO.has(tipoIngreso)) {
    throw new DatosInvalidosError('El tipo de ingreso no es válido.');
  }
  const ingreso = await conTransaccion(async (db) => {
    if (!(await repo.existePaciente(db, paciente))) {
      throw new NoEncontradoError('el paciente', paciente);
    }
    return repo.crearIngresoObservacion(db, { pacienteId: paciente, tipo: tipoIngreso });
  });
  publicar([{
    nombre: EVENTOS.PACIENTE_INGRESADO,
    carga: { pacienteId: ingreso.paciente_id, tipoIngreso: ingreso.tipo },
  }]);
  return ingreso;
}

module.exports = {
  listarPacientes,
  listarMedicos,
  listarTurnos,
  registrarPaciente,
  abrirTurno,
  reservar,
  insertarEntreturno,
  listarEspera,
  anotarEnEspera,
  cancelar,
  confirmar,
  registrarLlegada,
  atender,
  listarEnfermeros,
  listarGuardia,
  clasificarGuardia,
  ingresarObservacion,
};
