const pool = require('../../../shared/db/pool');
const { ConcurrenciaError } = require('../../../shared/errors/DomainError');
const Cama = require('../dominio/Cama');
const { NoEncontradoError, PacienteSinCamaError, DatosInvalidosError } = require('../dominio/errores');
const { CAMA_LIBERADA, PACIENTE_TRASLADADO, CAMA_ASIGNADA } = require('../dominio/eventos');
const repo = require('../repositorio/camasRepositorio');
const { conTransaccion } = require('../repositorio/transaccion');
const { publicar, cambioDeEstado } = require('./publicar');
const { operar, detalle } = require('./camasServicio');
const { enteroPositivo, texto, unoDe } = require('./validar');

const MOTIVOS_EGRESO = ['alta', 'traslado', 'otro'];
const MS_POR_DIA = 24 * 60 * 60 * 1000;

// Dias de internacion de una asignacion cerrada, como se cobran: todo dia
// empezado cuenta, con un minimo de 1. Facturacion lo usa para la Prestacion
// de tipo internacion.
function diasDeInternacion(ingreso, egreso) {
  const ms = new Date(egreso) - new Date(ingreso);
  return Math.max(1, Math.ceil(ms / MS_POR_DIA));
}

function eventoLiberada(cama, asignacion) {
  return {
    nombre: CAMA_LIBERADA,
    carga: {
      asignacionId: asignacion.id,
      camaId: cama.id,
      codigoCama: cama.codigo,
      pacienteId: asignacion.paciente_id,
      fechaHoraIngreso: asignacion.fecha_hora_ingreso,
      fechaHoraEgreso: asignacion.fecha_hora_egreso,
      dias: diasDeInternacion(asignacion.fecha_hora_ingreso, asignacion.fecha_hora_egreso),
      motivoEgreso: asignacion.motivo_egreso,
    },
  };
}

// Regla: al liberar se cierra la asignacion (fecha_hora_egreso) y la cama
// pasa a en_limpieza, nunca a disponible.
async function liberar(camaId, { motivoEgreso = 'alta' } = {}) {
  const motivo = unoDe(motivoEgreso, 'motivoEgreso', MOTIVOS_EGRESO);
  return operar(camaId, async (db, cama, eventos) => {
    cama.liberar(); // si no esta ocupada, el State lanza TransicionInvalidaError
    const vigente = await repo.asignacionVigenteDeCama(db, cama.id);
    if (!vigente) throw new Error(`La cama ${cama.codigo} figura ocupada pero no tiene asignación vigente.`);
    const cerrada = await repo.cerrarAsignacion(db, vigente.id, motivo);
    eventos.push(eventoLiberada(cama, cerrada));
  });
}

// Liberacion clinica por alta (HU 2.1 escenario 1). La dispara el evento
// PacienteDadoDeAlta de Atencion. Manda la asignacion vigente del paciente:
// si el evento trae otra camaId, se avisa por consola y se libera la real.
async function liberarPorAlta({ pacienteId, camaId } = {}) {
  const paciente = enteroPositivo(pacienteId, 'pacienteId');
  const vigente = await repo.asignacionVigenteDePaciente(pool, paciente);
  if (!vigente) throw new PacienteSinCamaError(paciente);
  if (camaId && Number(camaId) !== vigente.cama_id) {
    console.warn(
      `[camas] PacienteDadoDeAlta dice cama ${camaId}, pero el paciente ${paciente} está en la cama ${vigente.cama_id}. Se libera esa.`
    );
  }
  return liberar(vigente.cama_id, { motivoEgreso: 'alta' });
}

// HU 2.1 escenario 2: maestranza confirma la higiene.
async function finalizarLimpieza(camaId) {
  return operar(camaId, async (db, cama) => cama.finalizarLimpieza());
}

async function enviarAMantenimiento(camaId) {
  return operar(camaId, async (db, cama) => cama.enviarAMantenimiento());
}

async function finalizarMantenimiento(camaId) {
  return operar(camaId, async (db, cama) => cama.finalizarMantenimiento());
}

// Traslado: cerrar la asignacion actual y abrir otra en la cama destino,
// todo en una sola transaccion. Si cualquier paso falla no queda nada a medias.
async function trasladar(pacienteId, { camaDestinoId, motivo } = {}) {
  const paciente = enteroPositivo(pacienteId, 'pacienteId');
  const destinoId = enteroPositivo(camaDestinoId, 'camaDestinoId');
  const motivoTexto = texto(motivo, 'motivo', { opcional: true }) || 'Traslado';
  const eventos = [];

  await conTransaccion(async (db) => {
    const actual = await repo.asignacionVigenteDePaciente(db, paciente);
    if (!actual) throw new PacienteSinCamaError(paciente);
    if (actual.cama_id === destinoId) {
      throw new DatosInvalidosError('La cama destino es la misma en la que está el paciente.');
    }

    // Las dos camas, bloqueadas en orden de id (evita deadlocks entre traslados cruzados).
    const filas = await repo.bloquearCamas(db, [actual.cama_id, destinoId]);
    const filaOrigen = filas.find((f) => f.id === actual.cama_id);
    const filaDestino = filas.find((f) => f.id === destinoId);
    if (!filaDestino) throw new NoEncontradoError('la cama', destinoId);

    // Con las camas ya bloqueadas, confirmar que nadie movio al paciente mientras tanto.
    const confirmada = await repo.asignacionVigenteDePaciente(db, paciente);
    if (!confirmada || confirmada.id !== actual.id) {
      throw new ConcurrenciaError('El paciente fue movido por otra operación. Volvé a intentar.');
    }

    const origen = Cama.desdeFila(filaOrigen);
    const destino = Cama.desdeFila(filaDestino);
    const estadoOrigen = origen.nombreEstado;
    const estadoDestino = destino.nombreEstado;

    destino.asignar(paciente); // disponible o reservada para el paciente; si no, lanza
    origen.liberar();

    const cerrada = await repo.cerrarAsignacion(db, actual.id, 'traslado');
    const nueva = await repo.crearAsignacion(db, { camaId: destino.id, pacienteId: paciente, motivo: motivoTexto });
    await repo.guardarEstado(db, origen);
    await repo.guardarEstado(db, destino);

    eventos.push(
      eventoLiberada(origen, cerrada),
      {
        nombre: CAMA_ASIGNADA,
        carga: {
          asignacionId: nueva.id,
          camaId: destino.id,
          codigoCama: destino.codigo,
          pacienteId: paciente,
          fechaHoraIngreso: nueva.fecha_hora_ingreso,
        },
      },
      {
        nombre: PACIENTE_TRASLADADO,
        carga: {
          pacienteId: paciente,
          camaOrigenId: origen.id,
          camaDestinoId: destino.id,
          asignacionCerradaId: cerrada.id,
          asignacionNuevaId: nueva.id,
        },
      },
      cambioDeEstado(origen, estadoOrigen),
      cambioDeEstado(destino, estadoDestino)
    );
  });

  publicar(eventos);
  return detalle(destinoId);
}

module.exports = {
  liberar,
  liberarPorAlta,
  finalizarLimpieza,
  enviarAMantenimiento,
  finalizarMantenimiento,
  trasladar,
  diasDeInternacion,
};
