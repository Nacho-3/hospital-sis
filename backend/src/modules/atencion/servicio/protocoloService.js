const pool = require('../../../shared/db/pool');
const { conTransaccion } = require('../../../shared/db/transaccion');
const bus = require('../../../shared/events/eventBus');
const EVENTOS = require('../../../shared/events/eventos');
const protocoloRepo = require('../repositorio/protocoloRepo');
const { ProtocoloDirector } = require('../dominio/protocolos');
const { ErrorNegocio } = require('../dominio/errores');
const CONSTRUCTORES = {
  pre_quirurgico: ProtocoloDirector.preQuirurgico,
  infeccion_respiratoria: ProtocoloDirector.infeccionRespiratoria,
};

function enteroPositivo(valor, campo) {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) {
    throw new ErrorNegocio(`${campo} debe ser un entero positivo`, 'DATO_INVALIDO', 400);
  }
  return numero;
}

async function generarPorIngreso({ pacienteId, tipoIngreso }) {
  const construir = CONSTRUCTORES[tipoIngreso];
  if (!construir) return null;
  const paciente = enteroPositivo(pacienteId, 'pacienteId');
  return conTransaccion((db) =>
    protocoloRepo.insertarConTareas(db, paciente, construir())
  );
}

async function listarPorPaciente(pacienteId) {
  return protocoloRepo.listarPorPaciente(pool, enteroPositivo(pacienteId, 'pacienteId'));
}

async function realizarTarea(tareaId) {
  const tarea = await protocoloRepo.marcarTareaRealizada(
    pool,
    enteroPositivo(tareaId, 'tareaId')
  );
  if (!tarea) {
    throw new ErrorNegocio('La tarea del protocolo no existe', 'NO_ENCONTRADA', 404);
  }
  return tarea;
}

let listenersRegistrados = false;
function registrarListeners() {
  if (listenersRegistrados) return;
  listenersRegistrados = true;
  bus.on(EVENTOS.PACIENTE_INGRESADO, (evento) => {
    generarPorIngreso(evento).catch((err) => {
      console.error('[atencion] No se pudo generar el protocolo de ingreso:', err, evento);
    });
  });
}
module.exports = { generarPorIngreso, listarPorPaciente, realizarTarea, registrarListeners };