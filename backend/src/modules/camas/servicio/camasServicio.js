const pool = require('../../../shared/db/pool');
const Cama = require('../dominio/Cama');
const { ESTADOS } = require('../dominio/estados');
const {
  NoEncontradoError,
  PacienteYaInternadoError,
  CapacidadExcedidaError,
} = require('../dominio/errores');
const { CAMA_ASIGNADA } = require('../dominio/eventos');
const repo = require('../repositorio/camasRepositorio');
const { conTransaccion } = require('../repositorio/transaccion');
const { publicar, cambioDeEstado } = require('./publicar');
const { enteroPositivo, entero, texto, unoDe } = require('./validar');

const TIPOS_HABITACION = ['individual', 'compartida', 'uti', 'guardia'];

// ---------- Consultas ----------

async function mapa({ piso, estado } = {}) {
  const filtros = {};
  if (piso !== undefined && piso !== '') filtros.piso = entero(piso, 'piso');
  if (estado !== undefined && estado !== '') filtros.estado = unoDe(estado, 'estado', Object.keys(ESTADOS));
  return repo.listarMapa(pool, filtros);
}

async function detalle(camaId) {
  const id = enteroPositivo(camaId, 'camaId');
  const cama = await repo.obtenerDetalle(pool, id);
  if (!cama) throw new NoEncontradoError('la cama', id);
  return cama;
}

async function historial(camaId) {
  const id = enteroPositivo(camaId, 'camaId');
  return repo.historialDeCama(pool, id);
}

async function pacientesSinCama() {
  return repo.pacientesSinCama(pool);
}

async function habitaciones() {
  return repo.listarHabitaciones(pool);
}

// ---------- Alta de habitaciones y camas ----------

async function crearHabitacion(datos) {
  const habitacion = {
    numero: texto(datos.numero, 'numero', { max: 20 }),
    piso: entero(datos.piso, 'piso'),
    tipo: unoDe(datos.tipo, 'tipo', TIPOS_HABITACION),
    capacidad: enteroPositivo(datos.capacidad, 'capacidad'),
  };
  return conTransaccion((db) => repo.crearHabitacion(db, habitacion));
}

// Regla: una habitacion no puede superar su capacidad. La habitacion se
// bloquea para que dos altas simultaneas no cuenten la misma cantidad.
async function crearCama(datos) {
  const codigo = texto(datos.codigo, 'codigo', { max: 20 });
  const habitacionId = enteroPositivo(datos.habitacionId, 'habitacionId');
  return conTransaccion(async (db) => {
    const habitacion = await repo.bloquearHabitacion(db, habitacionId);
    if (!habitacion) throw new NoEncontradoError('la habitación', habitacionId);
    const total = await repo.contarCamas(db, habitacionId);
    if (total >= habitacion.capacidad) {
      throw new CapacidadExcedidaError(habitacion.numero, habitacion.capacidad);
    }
    return repo.crearCama(db, { codigo, habitacionId });
  });
}

// ---------- Operaciones sobre una cama (patron State) ----------

// Toma la cama con FOR UPDATE, aplica la operacion del estado y guarda.
// `aplicar` corre con la cama bloqueada: valida, llama a la operacion del
// estado y deja en `eventos` lo que hay que publicar despues del COMMIT.
async function operar(camaId, aplicar) {
  const id = enteroPositivo(camaId, 'camaId');
  const eventos = [];
  await conTransaccion(async (db) => {
    const fila = await repo.bloquearCama(db, id);
    if (!fila) throw new NoEncontradoError('la cama', id);
    const cama = Cama.desdeFila(fila);
    const estadoAnterior = cama.nombreEstado;
    await aplicar(db, cama, eventos);
    await repo.guardarEstado(db, cama);
    eventos.push(cambioDeEstado(cama, estadoAnterior));
  });
  publicar(eventos);
  return detalle(id);
}

async function validarPaciente(db, pacienteId) {
  if (!(await repo.existePaciente(db, pacienteId))) {
    throw new NoEncontradoError('el paciente', pacienteId);
  }
  // Regla: un paciente no puede tener dos asignaciones vigentes.
  // Si dos pedidos lo internan a la vez en camas distintas, lo frena
  // el indice unico asignaciones_paciente_vigente_uidx.
  if (await repo.asignacionVigenteDePaciente(db, pacienteId)) {
    throw new PacienteYaInternadoError(pacienteId);
  }
}

// HU 1.1: asignacion segura. Solo si la cama esta disponible o reservada
// para ese mismo paciente.
async function asignar(camaId, { pacienteId, motivo } = {}) {
  const paciente = enteroPositivo(pacienteId, 'pacienteId');
  const motivoTexto = texto(motivo, 'motivo', { opcional: true });
  return operar(camaId, async (db, cama, eventos) => {
    await validarPaciente(db, paciente);
    cama.asignar(paciente);
    const asignacion = await repo.crearAsignacion(db, {
      camaId: cama.id,
      pacienteId: paciente,
      motivo: motivoTexto,
    });
    eventos.push({
      nombre: CAMA_ASIGNADA,
      carga: {
        asignacionId: asignacion.id,
        camaId: cama.id,
        codigoCama: cama.codigo,
        pacienteId: paciente,
        fechaHoraIngreso: asignacion.fecha_hora_ingreso,
      },
    });
  });
}

async function reservar(camaId, { pacienteId } = {}) {
  const paciente = enteroPositivo(pacienteId, 'pacienteId');
  return operar(camaId, async (db, cama) => {
    await validarPaciente(db, paciente);
    cama.reservar(paciente);
  });
}

async function cancelarReserva(camaId) {
  return operar(camaId, async (db, cama) => cama.cancelarReserva());
}

module.exports = {
  mapa,
  detalle,
  historial,
  pacientesSinCama,
  habitaciones,
  crearHabitacion,
  crearCama,
  asignar,
  reservar,
  cancelarReserva,
  // Para los otros servicios del modulo.
  operar,
};
