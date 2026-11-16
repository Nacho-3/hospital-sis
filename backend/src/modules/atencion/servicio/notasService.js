const pool = require('../../../shared/db/pool');
const notasRepo = require('../repositorio/notasRepo');
const { ErrorNegocio } = require('../dominio/errores');

function enteroPositivo(valor, campo) {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) {
    throw new ErrorNegocio(`${campo} debe ser un entero positivo`, 'DATO_INVALIDO', 400);
  }
  return numero;
}

async function listarPorPaciente(pacienteId) {
  const id = enteroPositivo(pacienteId, 'pacienteId');
  return notasRepo.listarPorPaciente(pool, id);
}

async function crear({ pacienteId, enfermeroId, texto } = {}) {
  const paciente = enteroPositivo(pacienteId, 'pacienteId');
  const enfermero = enteroPositivo(enfermeroId, 'enfermeroId');
  if (typeof texto !== 'string' || !texto.trim() || texto.trim().length > 2000) {
    throw new ErrorNegocio('La nota es obligatoria y admite hasta 2000 caracteres', 'DATO_INVALIDO', 400);
  }
  return notasRepo.insertar(pool, {
    pacienteId: paciente,
    enfermeroId: enfermero,
    texto: texto.trim(),
  });
}

module.exports = { listarPorPaciente, crear };
