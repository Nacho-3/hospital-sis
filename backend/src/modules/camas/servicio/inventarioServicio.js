const pool = require('../../../shared/db/pool');
const { DomainError } = require('../../../shared/errors/DomainError');
const { NoEncontradoError, StockInsuficienteError, PacienteSinCamaError } = require('../dominio/errores');
const { STOCK_BAJO_DETECTADO } = require('../dominio/eventos');
const repo = require('../repositorio/inventarioRepositorio');
const { conTransaccion } = require('../repositorio/transaccion');
const { publicar } = require('./publicar');
const { enteroPositivo, entero, texto } = require('./validar');

// Regla: cuando stock_actual <= stock_minimo se emite una alerta de reposicion.
function alertaSiBajo(inventario, eventos) {
  if (inventario.stock_actual <= inventario.stock_minimo) {
    eventos.push({
      nombre: STOCK_BAJO_DETECTADO,
      carga: {
        inventarioPisoId: inventario.id,
        piso: inventario.piso,
        insumoId: inventario.insumo_id,
        insumo: inventario.insumo,
        stockActual: inventario.stock_actual,
        stockMinimo: inventario.stock_minimo,
      },
    });
  }
}

// ---------- Consultas ----------

async function inventario({ piso, bajo } = {}) {
  const filtros = { soloBajo: bajo === '1' || bajo === 'true' || bajo === true };
  if (piso !== undefined && piso !== '') filtros.piso = entero(piso, 'piso');
  return repo.listarInventario(pool, filtros);
}

async function movimientos(inventarioId) {
  return repo.movimientos(pool, enteroPositivo(inventarioId, 'inventarioId'));
}

async function insumos() {
  return repo.listarInsumos(pool);
}

// ---------- Altas ----------

async function crearInsumo(datos) {
  const insumo = {
    nombre: texto(datos.nombre, 'nombre', { max: 120 }),
    categoria: texto(datos.categoria, 'categoria', { opcional: true, max: 60 }) || 'medicamento',
    unidadMedida: texto(datos.unidadMedida, 'unidadMedida', { opcional: true, max: 40 }) || 'unidad',
  };
  return conTransaccion((db) => repo.crearInsumo(db, insumo));
}

async function configurar(datos) {
  const piso = entero(datos.piso, 'piso');
  const insumoId = enteroPositivo(datos.insumoId, 'insumoId');
  const stockMinimo = entero(datos.stockMinimo ?? 0, 'stockMinimo', { minimo: 0 });
  const stockInicial = entero(datos.stockInicial ?? 0, 'stockInicial', { minimo: 0 });
  const id = await conTransaccion(async (db) => {
    if (!(await repo.obtenerInsumo(db, insumoId))) throw new NoEncontradoError('el insumo', insumoId);
    const fila = await repo.configurarInventario(db, { piso, insumoId, stockInicial, stockMinimo });
    if (fila.creado && stockInicial > 0) {
      await repo.registrarMovimiento(db, {
        inventarioPisoId: fila.id,
        cantidad: stockInicial,
        stockResultante: stockInicial,
        motivo: 'ajuste',
      });
    }
    return fila.id;
  });
  const resultado = await repo.obtenerInventario(pool, id);
  const eventos = [];
  alertaSiBajo(resultado, eventos);
  publicar(eventos);
  return resultado;
}

async function reponer(inventarioId, { cantidad } = {}) {
  const id = enteroPositivo(inventarioId, 'inventarioId');
  const n = enteroPositivo(cantidad, 'cantidad');
  await conTransaccion(async (db) => {
    const fila = await repo.sumar(db, id, n);
    if (!fila) throw new NoEncontradoError('el registro de inventario', id);
    await repo.registrarMovimiento(db, {
      inventarioPisoId: id,
      cantidad: n,
      stockResultante: fila.stock_actual,
      motivo: 'reposicion',
    });
  });
  return repo.obtenerInventario(pool, id);
}

// ---------- HU 3.1: descuento por MedicacionAdministrada ----------

// Carga del evento: { administracionId, pacienteId, insumoId, cantidad }.
// El piso sale de la cama vigente del paciente. Si el mismo evento llega dos
// veces (mismo administracionId) no se descuenta de nuevo.
async function descontarPorMedicacion({ administracionId, pacienteId, insumoId, cantidad = 1 } = {}) {
  const paciente = enteroPositivo(pacienteId, 'pacienteId');
  const insumo = enteroPositivo(insumoId, 'insumoId');
  const n = enteroPositivo(cantidad, 'cantidad');
  const eventoOrigen = administracionId != null ? String(administracionId) : null;
  const eventos = [];

  try {
    const resultado = await conTransaccion(async (db) => {
      if (eventoOrigen && (await repo.movimientoPorEvento(db, eventoOrigen))) {
        return { duplicado: true };
      }

      const piso = await repo.pisoDePaciente(db, paciente);
      if (piso === null) throw new PacienteSinCamaError(paciente);

      const registro = await repo.buscarInventario(db, piso, insumo);
      if (!registro) {
        throw new DomainError(`El piso ${piso} no tiene inventario del insumo ${insumo}.`, {
          code: 'SIN_INVENTARIO',
          status: 409,
        });
      }

      const actualizado = await repo.descontar(db, registro.id, n);
      if (!actualizado) {
        // Se relee: entre el SELECT y el UPDATE otro descuento pudo cambiarlo.
        const ahora = await repo.obtenerInventario(db, registro.id);
        throw new StockInsuficienteError(registro.insumo, piso, ahora.stock_actual, n);
      }

      const movimiento = await repo.registrarMovimiento(db, {
        inventarioPisoId: registro.id,
        cantidad: -n,
        stockResultante: actualizado.stock_actual,
        motivo: 'medicacion_administrada',
        eventoOrigen,
        pacienteId: paciente,
      });

      alertaSiBajo({ ...registro, ...actualizado }, eventos);
      return { duplicado: false, movimiento, stockActual: actualizado.stock_actual, piso };
    });
    publicar(eventos);
    return resultado;
  } catch (err) {
    // Dos entregas simultaneas del mismo evento: la segunda choca con el
    // indice unico y hace ROLLBACK de su descuento. No es un error.
    if (err.code === '23505' && err.constraint === 'movimientos_stock_evento_uidx') {
      return { duplicado: true };
    }
    throw err;
  }
}

module.exports = {
  inventario,
  movimientos,
  insumos,
  crearInsumo,
  configurar,
  reponer,
  descontarPorMedicacion,
};
