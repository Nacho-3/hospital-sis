// Cargos, cobertura y cuenta contra la base real. Solo corre con DB_TESTS=1
// y borra lo que crea.
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

const test = require('node:test');
const assert = require('node:assert/strict');

const activo = process.env.DB_TESTS === '1';

test('facturacion contra la base', { skip: !activo }, async (t) => {
  const pool = require('../../../shared/db/pool');
  const eventBus = require('../../../shared/events/eventBus');
  const eventos = require('../../../shared/events/eventos');
  const facturacion = require('../servicio/facturacionServicio');
  const { registrarSuscriptores } = require('../suscriptores');
  const { NoEncontradoError, DatosInvalidosError, PrecioNoDefinidoError } = require('../dominio/errores');
  registrarSuscriptores();

  const marca = `TF${Date.now()}`.slice(-14);
  const fila = async (sql, valores) => (await pool.query(sql, valores)).rows[0];
  const crearPaciente = (nombre, n) => fila(
    `INSERT INTO pacientes (nombre, apellido, documento) VALUES ($1, 'Test', $2) RETURNING id`,
    [nombre, `TEST-FAC-${marca}-${n}`]
  );

  const conPrepaga = await crearPaciente('Prepaga', 1);
  const conPublica = await crearPaciente('Publica', 2);
  const particular = await crearPaciente('Particular', 3);
  const sinCuenta = await crearPaciente('SinCuenta', 4);
  const pacientes = [conPrepaga.id, conPublica.id, particular.id, sinCuenta.id];

  const prepaga = await fila(
    `INSERT INTO coberturas (nombre, tipo, copago_fijo) VALUES ($1, 'prepaga', 2500) RETURNING id`,
    [`Prepaga ${marca}`]
  );
  const publica = await fila(
    `INSERT INTO coberturas (nombre, tipo) VALUES ($1, 'publica') RETURNING id`,
    [`Publica ${marca}`]
  );
  const insumo = await fila(`INSERT INTO insumos (nombre) VALUES ($1) RETURNING id`, [`Insumo ${marca}`]);
  const sinPrecio = await fila(`INSERT INTO insumos (nombre) VALUES ($1) RETURNING id`, [`Sin precio ${marca}`]);
  // Un precio viejo y uno que todavia no rige: tiene que usarse el de 8500.
  await pool.query(
    `INSERT INTO precios_insumo (insumo_id, precio, vigente_desde) VALUES
       ($1, 100, DATE '2020-01-01'), ($1, 8500, DATE '2024-01-01'), ($1, 99999, CURRENT_DATE + 30)`,
    [insumo.id]
  );

  t.after(async () => {
    await pool.query('DELETE FROM cargos WHERE cuenta_id IN (SELECT id FROM cuentas WHERE paciente_id = ANY($1))', [pacientes]);
    await pool.query('DELETE FROM cuentas WHERE paciente_id = ANY($1)', [pacientes]);
    await pool.query('DELETE FROM paciente_cobertura WHERE paciente_id = ANY($1)', [pacientes]);
    await pool.query('DELETE FROM coberturas WHERE id = ANY($1)', [[prepaga.id, publica.id]]);
    await pool.query('DELETE FROM precios_insumo WHERE insumo_id = ANY($1)', [[insumo.id, sinPrecio.id]]);
    await pool.query('DELETE FROM insumos WHERE id = ANY($1)', [[insumo.id, sinPrecio.id]]);
    await pool.query('DELETE FROM pacientes WHERE id = ANY($1)', [pacientes]);
    await pool.end();
  });

  const carga = (pacienteId, n, extra = {}) => ({
    administracionId: `${marca}-${n}`, pacienteId, insumoId: insumo.id, cantidad: 1, ...extra,
  });
  const reparto = (cuenta) => cuenta.cargos
    .map((c) => `${c.destinatario}:${c.monto}`)
    .sort();

  await t.test('consultar la cuenta no la crea', async () => {
    const cuenta = await facturacion.cuentaDePaciente(sinCuenta.id);
    assert.equal(cuenta.cuentaId, null);
    assert.deepEqual(cuenta.cargos, []);
    assert.equal(cuenta.totalAcumulado, 0);
    const { n } = await fila('SELECT count(*)::int AS n FROM cuentas WHERE paciente_id = $1', [sinCuenta.id]);
    assert.equal(n, 0);
  });

  await t.test('asignar y quitar cobertura deja historial', async () => {
    assert.equal((await facturacion.coberturaDePaciente(conPrepaga.id)).cobertura.tipo, 'particular');

    await facturacion.asignarCobertura(conPrepaga.id, { coberturaId: publica.id });
    const actual = await facturacion.asignarCobertura(conPrepaga.id, { coberturaId: prepaga.id });
    assert.equal(actual.cobertura.id, prepaga.id);
    assert.equal(actual.cobertura.copago_fijo, 2500);

    const { total, vigentes } = await fila(
      `SELECT count(*)::int AS total, count(*) FILTER (WHERE vigente_hasta IS NULL)::int AS vigentes
         FROM paciente_cobertura WHERE paciente_id = $1`,
      [conPrepaga.id]
    );
    assert.deepEqual({ total, vigentes }, { total: 2, vigentes: 1 });

    // null la deja como particular, y vuelve a asignarse sin chocar con el historial.
    assert.equal((await facturacion.asignarCobertura(conPublica.id, { coberturaId: publica.id })).cobertura.tipo, 'publica');
    assert.equal((await facturacion.asignarCobertura(conPublica.id, { coberturaId: null })).cobertura.tipo, 'particular');
    await facturacion.asignarCobertura(conPublica.id, { coberturaId: publica.id });
    await assert.rejects(facturacion.asignarCobertura(conPrepaga.id, { coberturaId: 999999999 }), NoEncontradoError);
    await assert.rejects(facturacion.asignarCobertura(conPrepaga.id, {}), DatosInvalidosError);
  });

  await t.test('MedicacionAdministrada genera un cargo por destinatario segun la cobertura', async () => {
    // Por el eventBus, como lo va a publicar Atencion.
    eventBus.emit(eventos.MEDICACION_ADMINISTRADA, carga(conPrepaga.id, 'prepaga'));
    await new Promise((r) => setTimeout(r, 300));
    const cuentaPrepaga = await facturacion.cuentaDePaciente(conPrepaga.id);
    assert.deepEqual(reparto(cuentaPrepaga), ['obra_social:6000', 'paciente:2500']);
    assert.equal(cuentaPrepaga.totalAcumulado, 8500);
    assert.deepEqual(cuentaPrepaga.totales, { paciente: 2500, obra_social: 6000, estado: 0 });
    assert.equal(cuentaPrepaga.cargos[0].concepto, 'Insumos de Farmacia');
    assert.equal(cuentaPrepaga.cargos[0].detalle, `Insumo ${marca} x1`);

    await facturacion.registrarCargoPorMedicacion(carga(conPublica.id, 'publica', { cantidad: 2 }));
    assert.deepEqual(reparto(await facturacion.cuentaDePaciente(conPublica.id)), ['estado:17000', 'paciente:0']);

    await facturacion.registrarCargoPorMedicacion(carga(particular.id, 'particular'));
    assert.deepEqual(reparto(await facturacion.cuentaDePaciente(particular.id)), ['paciente:8500']);
  });

  await t.test('el mismo evento no se cobra dos veces, ni llegando a la vez', async () => {
    const repetido = await facturacion.registrarCargoPorMedicacion(carga(conPrepaga.id, 'prepaga'));
    assert.equal(repetido.duplicado, true);

    const simultaneos = await Promise.all(
      Array.from({ length: 6 }, () => facturacion.registrarCargoPorMedicacion(carga(conPrepaga.id, 'doble')))
    );
    assert.equal(simultaneos.filter((r) => !r.duplicado).length, 1);

    // 2 cargos del primer evento + 2 del segundo.
    assert.equal((await facturacion.cuentaDePaciente(conPrepaga.id)).cargos.length, 4);
  });

  await t.test('cargos simultaneos de un paciente sin cuenta abren una sola cuenta y no se pierden', async () => {
    await Promise.all(Array.from({ length: 10 }, () => pool.query('SELECT 1'))); // conexiones ya abiertas
    const resultados = await Promise.all(
      Array.from({ length: 10 }, (_, n) => facturacion.registrarCargoPorMedicacion(carga(sinCuenta.id, `carrera-${n}`)))
    );
    assert.ok(resultados.every((r) => !r.duplicado && r.cargos.length === 1));

    const cuenta = await facturacion.cuentaDePaciente(sinCuenta.id);
    assert.equal(cuenta.cargos.length, 10);
    assert.equal(cuenta.totalAcumulado, 85000);
    const { n } = await fila('SELECT count(*)::int AS n FROM cuentas WHERE paciente_id = $1', [sinCuenta.id]);
    assert.equal(n, 1);
  });

  await t.test('cargo manual reparte con la cobertura vigente', async () => {
    const cargos = await facturacion.registrarCargoManual(conPrepaga.id, { concepto: '  Radiografia  ', monto: 1000.5 });
    assert.deepEqual(cargos.map((c) => [c.destinatario, c.monto, c.concepto, c.evento_origen]), [
      ['paciente', 1000.5, 'Radiografia', null],
    ]);
  });

  await t.test('datos invalidos o inexistentes cortan con un error de negocio y no guardan nada', async () => {
    const antes = await fila('SELECT count(*)::int AS n FROM cargos');
    await assert.rejects(facturacion.cuentaDePaciente('abc'), DatosInvalidosError);
    await assert.rejects(facturacion.cuentaDePaciente(999999999), NoEncontradoError);
    await assert.rejects(facturacion.registrarCargoManual(particular.id, { concepto: 'x', monto: -5 }), DatosInvalidosError);
    await assert.rejects(facturacion.registrarCargoManual(particular.id, { concepto: '', monto: 5 }), DatosInvalidosError);
    await assert.rejects(facturacion.registrarCargoPorMedicacion(carga(particular.id, 'cero', { cantidad: 0 })), DatosInvalidosError);
    await assert.rejects(facturacion.registrarCargoPorMedicacion(carga(999999999, 'fantasma')), NoEncontradoError);
    await assert.rejects(
      facturacion.registrarCargoPorMedicacion(carga(particular.id, 'sin-precio', { insumoId: sinPrecio.id })),
      PrecioNoDefinidoError
    );
    assert.deepEqual(await fila('SELECT count(*)::int AS n FROM cargos'), antes);
  });
});
