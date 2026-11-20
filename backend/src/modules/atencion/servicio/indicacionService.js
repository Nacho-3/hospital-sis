const indicacionesRepo = require('../repositorio/indicacionesRepo');
const admRepo = require('../repositorio/administracionesRepo');
const medicamentosRepo = require('../repositorio/medicamentosRepo');
const pool = require('../../../shared/db/pool');
const { conTransaccion } = require('../../../shared/db/transaccion');
const { ErrorNegocio } = require('../dominio/errores');

function enteroPositivo(valor, campo) {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) {
    throw new ErrorNegocio(`${campo} debe ser un entero positivo`, 'DATO_INVALIDO', 400);
  }
  return numero;
}

async function crear({ pacienteId, medicoId, insumoId, dosis, cantidad = 1, intervaloHoras, margenMinutos = 30, primeraDosis }) {
  const paciente = enteroPositivo(pacienteId, 'pacienteId');
  const medico = enteroPositivo(medicoId, 'medicoId');
  const insumo = enteroPositivo(insumoId, 'insumoId');
  const intervalo = enteroPositivo(intervaloHoras, 'intervaloHoras');
  // Unidades del insumo por dosis: es lo que Camas descuenta del stock al confirmar.
  const unidades = enteroPositivo(cantidad, 'cantidad');
  if (typeof dosis !== 'string' || !dosis.trim() || dosis.trim().length > 80) {
    throw new ErrorNegocio('La dosis es obligatoria y admite hasta 80 caracteres', 'DATO_INVALIDO', 400);
  }
  const margen = Number(margenMinutos);
  if (!Number.isInteger(margen) || margen < 0) {
    throw new ErrorNegocio('margenMinutos debe ser un entero no negativo', 'DATO_INVALIDO', 400);
  }
  const fechaPrimeraDosis = new Date(primeraDosis);
  if (!primeraDosis || Number.isNaN(fechaPrimeraDosis.getTime())) {
    throw new ErrorNegocio('primeraDosis debe ser una fecha válida', 'DATO_INVALIDO', 400);
  }

  return conTransaccion(async (db) => {
    const indicacion = await indicacionesRepo.insertar(db, {
      pacienteId: paciente,
      medicoId: medico,
      insumoId: insumo,
      dosis: dosis.trim(),
      intervaloHoras: intervalo,
      margenMinutos: margen,
    });
    const primeraAdministracion = await admRepo.insertar(db, {
      indicacionId: indicacion.id,
      programadaPara: fechaPrimeraDosis,
      cantidad: unidades,
    });
    return { ...indicacion, primeraAdministracion };
  });
}

// Lo que el medico necesita para recetar: los medicamentos y, si el paciente
// esta internado, el stock de su piso (de ahi lo descuenta Camas al confirmar
// cada dosis).
async function medicamentosParaPaciente(pacienteId) {
  const paciente = enteroPositivo(pacienteId, 'pacienteId');
  const piso = await medicamentosRepo.pisoDelPaciente(pool, paciente);
  const filas = await medicamentosRepo.listarConStock(pool, piso);
  return {
    piso,
    medicamentos: filas.map((f) => ({
      id: f.id,
      nombre: f.nombre,
      unidad: f.unidad_medida,
      stock: f.stock_actual,
    })),
  };
}

module.exports = { crear, medicamentosParaPaciente };