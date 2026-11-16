const pool = require('../../../shared/db/pool');
const { ConcurrenciaError } = require('../../../shared/errors/DomainError');
const { NoEncontradoError, PrecioNoDefinidoError } = require('../dominio/errores');
const { COBERTURA_PARTICULAR, DESTINATARIOS, calcularDistribucionCargo } = require('../dominio/EstrategiaCobertura');
const { aCentavos, aPesos, sumar } = require('../dominio/dinero');
const repo = require('../repositorio/facturacionRepositorio');
const { conTransaccion } = require('../repositorio/transaccion');
const { enteroPositivo, texto, monto, busqueda } = require('./validar');

// unique_violation de PostgreSQL.
const PG_VIOLACION_UNICA = '23505';

// Concepto de los cargos automaticos por medicacion (HU 2.1). El insumo y la
// cantidad van en el detalle.
const CONCEPTO_INSUMOS = 'Insumos de Farmacia';

// "Ana Rojas": asi figura el paciente en los cargos a su nombre (HU 1.1).
function nombreCompleto(paciente) {
  return `${paciente.nombre} ${paciente.apellido}`;
}

async function pacienteExistente(db, pacienteId) {
  const paciente = await repo.obtenerPaciente(db, pacienteId);
  if (!paciente) throw new NoEncontradoError('el paciente', pacienteId);
  return paciente;
}

// ---------- Pacientes ----------

// Busca por nombre y apellido, en cualquier orden y sin importar tildes ni mayusculas.
async function buscarPacientes(q) {
  return repo.buscarPacientes(pool, busqueda(q, 'La busqueda'));
}

// ---------- Cobertura ----------

async function coberturas() {
  return repo.listarCoberturas(pool);
}

async function coberturaDePaciente(pacienteId) {
  const id = enteroPositivo(pacienteId, 'pacienteId');
  await pacienteExistente(pool, id);
  const vigente = await repo.coberturaVigenteDePaciente(pool, id);
  return { pacienteId: id, cobertura: vigente || COBERTURA_PARTICULAR };
}

// Cambia la cobertura vigente del paciente. coberturaId null = queda como particular.
// La anterior no se borra: se cierra con vigente_hasta y queda como historial.
// Los cargos ya generados no se recalculan.
async function asignarCobertura(pacienteId, { coberturaId } = {}) {
  const id = enteroPositivo(pacienteId, 'pacienteId');
  // undefined no es null: un pedido sin el campo no tiene que dejar al paciente sin cobertura.
  const nuevaId = coberturaId === null ? null : enteroPositivo(coberturaId, 'coberturaId');

  try {
    await conTransaccion(async (db) => {
      await pacienteExistente(db, id);
      if (nuevaId !== null && !(await repo.obtenerCobertura(db, nuevaId))) {
        throw new NoEncontradoError('la cobertura', nuevaId);
      }
      const vigente = await repo.coberturaVigenteDePaciente(db, id);
      if ((vigente ? vigente.id : null) === nuevaId) return;

      await repo.cerrarCoberturaVigente(db, id);
      if (nuevaId !== null) await repo.abrirCobertura(db, id, nuevaId);
    });
  } catch (err) {
    // Dos cambios simultaneos para el mismo paciente: el segundo choca con el indice unico.
    if (err.code === PG_VIOLACION_UNICA && err.constraint === 'paciente_cobertura_vigente_uidx') {
      throw new ConcurrenciaError('Otro usuario acaba de cambiar la cobertura de este paciente.');
    }
    throw err;
  }
  return coberturaDePaciente(id);
}

// ---------- Cuenta ----------

// Cuenta activa del paciente con sus cargos y totales. Consultar no abre una
// cuenta: si todavia no tiene, cuentaId va en null y la lista vacia.
async function cuentaDePaciente(pacienteId) {
  const id = enteroPositivo(pacienteId, 'pacienteId');
  const paciente = await pacienteExistente(pool, id);
  const cuenta = await repo.cuentaActiva(pool, id);
  const cargos = cuenta ? await repo.cargosDeCuenta(pool, cuenta.id) : [];

  const totalDe = (destinatario) =>
    sumar(cargos.filter((c) => c.destinatario === destinatario).map((c) => c.monto));

  return {
    pacienteId: id,
    paciente: nombreCompleto(paciente),
    cuentaId: cuenta ? cuenta.id : null,
    abiertaEn: cuenta ? cuenta.abierta_en : null,
    totalAcumulado: sumar(cargos.map((c) => c.monto)),
    totales: {
      [DESTINATARIOS.PACIENTE]: totalDe(DESTINATARIOS.PACIENTE),
      [DESTINATARIOS.OBRA_SOCIAL]: totalDe(DESTINATARIOS.OBRA_SOCIAL),
      [DESTINATARIOS.ESTADO]: totalDe(DESTINATARIOS.ESTADO),
    },
    cargos,
  };
}

// ---------- Cargos ----------

// Reparte el monto segun la cobertura vigente (Strategy) y guarda un cargo por
// destinatario en la cuenta activa. Corre dentro de la transaccion de quien llama.
// `origen` son los datos que comparten todos los cargos de la operacion:
// { concepto, detalle?, insumoId?, nomencladorId?, eventoOrigen? }.
async function guardarCargos(db, { paciente, montoTotal, ...origen }) {
  const cobertura = await repo.coberturaVigenteDePaciente(db, paciente.id);
  const partes = calcularDistribucionCargo({
    montoTotal,
    cobertura,
    nombrePaciente: nombreCompleto(paciente),
  });
  const cuentaId = await repo.obtenerOCrearCuentaActiva(db, paciente.id);
  const cargos = [];
  for (const parte of partes) {
    cargos.push(await repo.insertarCargo(db, { cuentaId, ...origen, ...parte }));
  }
  return cargos;
}

// Cargo cargado a mano desde la pantalla: { concepto, monto }.
async function registrarCargoManual(pacienteId, datosDelCargo = {}) {
  const id = enteroPositivo(pacienteId, 'pacienteId');
  const datos = {
    concepto: texto(datosDelCargo.concepto, 'concepto', { max: 160 }),
    montoTotal: monto(datosDelCargo.monto, 'monto'),
  };
  return conTransaccion(async (db) => {
    const paciente = await pacienteExistente(db, id);
    return guardarCargos(db, { paciente, ...datos });
  });
}

// HU 1.1: factura una prestacion del nomenclador ("Consulta Medica General")
// por su valor base, repartido segun la cobertura del paciente.
async function registrarCargoPorPrestacion(pacienteId, { nomencladorId } = {}) {
  const id = enteroPositivo(pacienteId, 'pacienteId');
  const prestacionId = enteroPositivo(nomencladorId, 'nomencladorId');
  return conTransaccion(async (db) => {
    const paciente = await pacienteExistente(db, id);
    const prestacion = await repo.obtenerPrestacion(db, prestacionId);
    if (!prestacion) throw new NoEncontradoError('la prestacion', prestacionId);
    return guardarCargos(db, {
      paciente,
      montoTotal: prestacion.valor_base,
      concepto: prestacion.descripcion,
      detalle: prestacion.codigo,
      nomencladorId: prestacion.id,
    });
  });
}

async function nomenclador() {
  return repo.listarNomenclador(pool);
}

// Valida la carga de MedicacionAdministrada: { administracionId, pacienteId, insumoId, cantidad }.
function cargaDeMedicacion({ administracionId, pacienteId, insumoId, cantidad = 1 } = {}) {
  return {
    administracionId: texto(administracionId, 'administracionId', { max: 100 }),
    pacienteId: enteroPositivo(pacienteId, 'pacienteId'),
    insumoId: enteroPositivo(insumoId, 'insumoId'),
    cantidad: enteroPositivo(cantidad, 'cantidad'),
  };
}

// HU 2.1: cargo automatico al recibir MedicacionAdministrada.
// El mismo administracionId no se cobra dos veces: si el evento ya genero
// cargos, o esta llegando dos veces a la vez, devuelve { duplicado: true }.
async function registrarCargoPorMedicacion(carga) {
  const { administracionId, pacienteId, insumoId, cantidad } = cargaDeMedicacion(carga);
  const eventoOrigen = `medicacion_${administracionId}`;

  try {
    return await conTransaccion(async (db) => {
      if (await repo.existenCargosDeEvento(db, eventoOrigen)) {
        return { duplicado: true, cargos: [] };
      }
      const paciente = await pacienteExistente(db, pacienteId);
      const precio = await repo.precioVigenteDeInsumo(db, insumoId);
      if (!precio) throw new PrecioNoDefinidoError(insumoId);

      const cargos = await guardarCargos(db, {
        paciente,
        concepto: CONCEPTO_INSUMOS,
        detalle: `${precio.insumo} x${cantidad}`,
        montoTotal: aPesos(aCentavos(precio.precio) * cantidad),
        insumoId,
        eventoOrigen,
      });
      return { duplicado: false, cargos };
    });
  } catch (err) {
    // Dos entregas simultaneas del mismo evento: la segunda choca con el
    // indice unico y hace ROLLBACK de todos sus cargos. No es un error.
    if (err.code === PG_VIOLACION_UNICA && err.constraint === 'cargos_evento_destinatario_uidx') {
      return { duplicado: true, cargos: [] };
    }
    throw err;
  }
}

async function preciosVigentes() {
  return repo.listarPreciosVigentes(pool);
}

module.exports = {
  buscarPacientes,
  coberturas,
  coberturaDePaciente,
  asignarCobertura,
  cuentaDePaciente,
  registrarCargoManual,
  registrarCargoPorPrestacion,
  nomenclador,
  cargaDeMedicacion,
  registrarCargoPorMedicacion,
  preciosVigentes,
};
