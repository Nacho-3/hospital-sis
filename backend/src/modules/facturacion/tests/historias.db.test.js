// Criterios de aceptacion de las historias de Facturacion, con los datos
// exactos de cada escenario. Solo corre con DB_TESTS=1 y borra lo que crea.
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

const test = require('node:test');
const assert = require('node:assert/strict');

const activo = process.env.DB_TESTS === '1';
const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

test('historias de usuario de Facturacion', { skip: !activo }, async (t) => {
  const pool = require('../../../shared/db/pool');
  const eventBus = require('../../../shared/events/eventBus');
  const { MEDICACION_ADMINISTRADA } = require('../../../shared/events/eventos');
  const facturacion = require('../servicio/facturacionServicio');
  const { registrarSuscriptores } = require('../suscriptores');
  registrarSuscriptores();

  const marca = `HU${Date.now()}`;
  const fila = async (sql, valores) => (await pool.query(sql, valores)).rows[0];
  const paciente = (nombre, apellido, n) => fila(
    'INSERT INTO pacientes (nombre, apellido, documento) VALUES ($1, $2, $3) RETURNING id',
    [nombre, apellido, `${marca}-${n}`]
  );

  const juan = await paciente('Juan', 'Gómez', 1);
  const ana = await paciente('Ana', 'Rojas', 2);
  const carlos = await paciente('Carlos', 'López', 3);
  const ids = [juan.id, ana.id, carlos.id];

  const publica = await fila(`SELECT id FROM coberturas WHERE nombre = 'Obra Social Pública'`);
  const premium = await fila(`SELECT id, copago_fijo::float8 AS copago FROM coberturas WHERE nombre = 'Medicina Prepaga Premium'`);
  const consulta = await fila(`SELECT id, valor_base::float8 AS valor FROM nomenclador WHERE descripcion = 'Consulta Médica General'`);
  const ibuprofeno = await fila(`SELECT id FROM insumos WHERE nombre = 'Ibuprofeno 400mg'`);
  const precio = await fila(
    `SELECT precio::float8 AS precio FROM precios_insumo
      WHERE insumo_id = $1 AND vigente_desde <= CURRENT_DATE
      ORDER BY vigente_desde DESC LIMIT 1`,
    [ibuprofeno.id]
  );

  t.after(async () => {
    await pool.query('DELETE FROM cargos WHERE cuenta_id IN (SELECT id FROM cuentas WHERE paciente_id = ANY($1))', [ids]);
    await pool.query('DELETE FROM cuentas WHERE paciente_id = ANY($1)', [ids]);
    await pool.query('DELETE FROM paciente_cobertura WHERE paciente_id = ANY($1)', [ids]);
    await pool.query('DELETE FROM pacientes WHERE id = ANY($1)', [ids]);
    await pool.end();
  });

  const resumen = (cargos) => cargos.map((c) => [c.destinatario, c.destinatario_nombre, c.monto]);

  await t.test('los datos de los escenarios estan cargados', () => {
    assert.ok(publica, 'falta la cobertura "Obra Social Pública"');
    assert.equal(premium.copago, 3000);
    assert.equal(consulta.valor, 15000);
    assert.ok(precio, 'Ibuprofeno 400mg no tiene precio vigente');
  });

  await t.test('HU 1.1 esc. 1: cobertura publica -> $0 al paciente y $15.000 al Estado', async () => {
    // Dado que Juan Gomez esta registrado con "Obra Social Pública"
    await facturacion.asignarCobertura(juan.id, { coberturaId: publica.id });
    // Cuando el modulo recibe la orden de facturar una "Consulta Médica General" de 15000
    const cargos = await facturacion.registrarCargoPorPrestacion(juan.id, { nomencladorId: consulta.id });
    // Entonces un cargo de 0 pesos a nombre del paciente
    // Y un cargo subsidiado de 15000 a nombre del Estado
    assert.deepEqual(resumen(cargos), [
      ['paciente', 'Juan Gómez', 0],
      ['estado', 'Obra Social Pública', 15000],
    ]);
    assert.ok(cargos.every((c) => c.concepto === 'Consulta Médica General'));
  });

  await t.test('HU 1.1 esc. 2: prepaga con copago 3000 -> $3.000 a Ana Rojas y $12.000 a la prepaga', async () => {
    // Dado que Ana Rojas esta registrada con "Medicina Prepaga Premium" (copago fijo 3000)
    await facturacion.asignarCobertura(ana.id, { coberturaId: premium.id });
    // Cuando el modulo recibe la orden de facturar una "Consulta Médica General" de 15000
    const cargos = await facturacion.registrarCargoPorPrestacion(ana.id, { nomencladorId: consulta.id });
    // Entonces 3000 a nombre de Ana Rojas
    // Y un reclamo a terceros por los 12000 restantes dirigido a la prepaga
    assert.deepEqual(resumen(cargos), [
      ['paciente', 'Ana Rojas', 3000],
      ['obra_social', 'Medicina Prepaga Premium', 12000],
    ]);
  });

  await t.test('Regla particular: sin cobertura cobra el 100% del valor base al paciente', async () => {
    const cargos = await facturacion.registrarCargoPorPrestacion(carlos.id, { nomencladorId: consulta.id });
    assert.deepEqual(resumen(cargos), [['paciente', 'Carlos López', 15000]]);
  });

  await t.test('HU 2.1 esc. 1: MedicacionAdministrada -> linea "Insumos de Farmacia" vinculada al evento', async () => {
    // Dado que Carlos Lopez tiene una cuenta de gastos activa (la abrio la consulta anterior)
    const antes = await facturacion.cuentaDePaciente(carlos.id);
    assert.ok(antes.cuentaId);

    // Cuando se recibe el evento asincrono por 1 unidad de Ibuprofeno 400mg
    const administracionId = `${marca}-adm-1`;
    eventBus.emit(MEDICACION_ADMINISTRADA, {
      administracionId, pacienteId: carlos.id, insumoId: ibuprofeno.id, cantidad: 1,
    });
    await esperar(400);

    // Entonces consulta el precio vigente y agrega una linea a la MISMA cuenta
    const despues = await facturacion.cuentaDePaciente(carlos.id);
    assert.equal(despues.cuentaId, antes.cuentaId);
    assert.equal(despues.cargos.length, antes.cargos.length + 1);
    const linea = despues.cargos.find((c) => c.evento_origen);
    assert.equal(linea.concepto, 'Insumos de Farmacia');
    assert.equal(linea.detalle, 'Ibuprofeno 400mg x1');
    assert.equal(linea.monto, precio.precio);
    assert.equal(linea.insumo_id, ibuprofeno.id);
    // Y vinculada al ID del evento original (trazabilidad)
    assert.equal(linea.evento_origen, `medicacion_${administracionId}`);
  });

  await t.test('HU 2.1: el mismo evento repetido no genera una segunda linea', async () => {
    const antes = (await facturacion.cuentaDePaciente(carlos.id)).cargos.length;
    eventBus.emit(MEDICACION_ADMINISTRADA, {
      administracionId: `${marca}-adm-1`, pacienteId: carlos.id, insumoId: ibuprofeno.id, cantidad: 1,
    });
    await esperar(400);
    assert.equal((await facturacion.cuentaDePaciente(carlos.id)).cargos.length, antes);
  });
});
