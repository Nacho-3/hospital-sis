const pool = require('../../../shared/db/pool');
const bus = require('../../../shared/events/eventBus');
const EVENTOS = require('../../../shared/events/eventos');
const avisosRepo = require('../repositorio/avisosRepo');
const { ErrorNegocio } = require('../dominio/errores');

function enteroPositivo(valor, campo) {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) {
    throw new ErrorNegocio(`${campo} debe ser un entero positivo`, 'DATO_INVALIDO', 400);
  }
  return numero;
}

async function anotarMostrador({ turnoId, pacienteId, medicoId } = {}) {
  return avisosRepo.insertar(pool, {
    tipo: 'mostrador',
    pacienteId: enteroPositivo(pacienteId, 'pacienteId'),
    turnoId: enteroPositivo(turnoId, 'turnoId'),
    medicoId: enteroPositivo(medicoId, 'medicoId'),
  });
}

async function anotarCodigoRojo({ pacienteId, nivel } = {}) {
  if (nivel !== 'rojo') return null;
  return avisosRepo.insertar(pool, {
    tipo: 'codigo_rojo',
    pacienteId: enteroPositivo(pacienteId, 'pacienteId'),
  });
}

function listarAbiertos() {
  return avisosRepo.listarAbiertos(pool);
}

async function cerrar(id) {
  const aviso = await avisosRepo.cerrar(pool, enteroPositivo(id, 'id'));
  if (!aviso) throw new ErrorNegocio('El aviso no existe', 'NO_ENCONTRADO', 404);
  return aviso;
}

let listenersRegistrados = false;
function registrarListeners() {
  if (listenersRegistrados) return;
  listenersRegistrados = true;
  bus.on(EVENTOS.TURNO_EN_SALA_DE_ESPERA, (evento) => {
    anotarMostrador(evento).catch((err) => {
      console.error('[atencion] No se pudo anotar la llegada al mostrador:', err, evento);
    });
  });
  bus.on(EVENTOS.TRIAJE_RIESGO_VITAL, (evento) => {
    anotarCodigoRojo(evento).catch((err) => {
      console.error('[atencion] No se pudo anotar el código rojo:', err, evento);
    });
  });
}

module.exports = {
  anotarMostrador,
  anotarCodigoRojo,
  listarAbiertos,
  cerrar,
  registrarListeners,
};
