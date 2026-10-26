// Descuento de stock contra la base real (HU 3.1). Solo corre con DB_TESTS=1
// y borra lo que crea.
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

const test = require('node:test');
const assert = require('node:assert/strict');

const activo = process.env.DB_TESTS === '1';

test('descuento atomico por MedicacionAdministrada', { skip: !activo }, async (t) => {
  const pool = require('../../../shared/db/pool');
  const eventBus = require('../../../shared/events/eventBus');
  const eventos = require('../../../shared/events/eventos');
  const { STOCK_BAJO_DETECTADO } = require('../dominio/eventos');
  const { registrarSuscriptores } = require('../suscriptores');
  const camas = require('../servicio/camasServicio');
  const inventario = require('../servicio/inventarioServicio');
  registrarSuscriptores();

  const marca = `TI${Date.now()}`.slice(-14);
  const { rows: [paciente] } = await pool.query(
    `INSERT INTO pacientes (nombre, apellido, documento) VALUES ('Ana', 'Rojas', $1) RETURNING id`,
    [`TEST-CAMAS-${marca}`]
  );
  const hab = await camas.crearHabitacion({ numero: marca, piso: 99, tipo: 'individual', capacidad: 1 });
  const cama = await camas.crearCama({ codigo: marca, habitacionId: hab.id });
  await camas.asignar(cama.id, { pacienteId: paciente.id });
  const insumo = await inventario.crearInsumo({ nombre: `Ibuprofeno test ${marca}`, unidadMedida: 'comprimido' });
  const registro = await inventario.configurar({ piso: 99, insumoId: insumo.id, stockInicial: 50, stockMinimo: 25 });

  t.after(async () => {
    await pool.query('DELETE FROM movimientos_stock WHERE inventario_piso_id = $1', [registro.id]);
    await pool.query('DELETE FROM inventario_piso WHERE id = $1', [registro.id]);
    await pool.query('DELETE FROM insumos WHERE id = $1', [insumo.id]);
    await pool.query('DELETE FROM asignaciones_cama WHERE cama_id = $1', [cama.id]);
    await pool.query('DELETE FROM camas WHERE id = $1', [cama.id]);
    await pool.query('DELETE FROM habitaciones WHERE id = $1', [hab.id]);
    await pool.query('DELETE FROM pacientes WHERE id = $1', [paciente.id]);
    await pool.end();
  });

  const stock = async () => (await inventario.inventario({ piso: 99 }))[0].stock_actual;
  const carga = (n) => ({ administracionId: `${marca}-${n}`, pacienteId: paciente.id, insumoId: insumo.id, cantidad: 1 });

  // Escenario de la HU: 50 -> 49 al recibir el evento de Atencion.
  eventBus.emit(eventos.MEDICACION_ADMINISTRADA, carga(0));
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(await stock(), 49);

  // El mismo evento otra vez (y dos a la vez) no descuenta de nuevo.
  const repetidos = await Promise.all([
    inventario.descontarPorMedicacion(carga(0)),
    inventario.descontarPorMedicacion(carga(0)),
  ]);
  assert.ok(repetidos.every((r) => r.duplicado));
  assert.equal(await stock(), 49);

  // 24 descuentos simultaneos: ninguno se pierde ni lee un stock viejo.
  const alertas = [];
  eventBus.on(STOCK_BAJO_DETECTADO, (c) => alertas.push(c));
  await Promise.all(Array.from({ length: 24 }, (_, i) => inventario.descontarPorMedicacion(carga(i + 1))));
  assert.equal(await stock(), 25);
  assert.ok(alertas.length >= 1, 'al llegar al minimo se emite StockBajoDetectado');

  // El stock nunca queda negativo.
  await assert.rejects(
    inventario.descontarPorMedicacion({ ...carga(100), cantidad: 26 }),
    { code: 'STOCK_INSUFICIENTE' }
  );
  assert.equal(await stock(), 25);

  // Reposicion.
  await inventario.reponer(registro.id, { cantidad: 10 });
  assert.equal(await stock(), 35);
  const movs = await inventario.movimientos(registro.id);
  assert.equal(movs.filter((m) => m.motivo === 'medicacion_administrada').length, 25);
});
