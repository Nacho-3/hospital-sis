// Recetar desde Atencion y descontar el stock, de punta a punta contra la base.
// Solo corre con DB_TESTS=1. Usa la app completa, asi tambien escuchan Camas y
// Facturacion, y deja la base como estaba (stock incluido).
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-test';

const test = require('node:test');
const { after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const activo = process.env.DB_TESTS === '1';
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// La conexion se cierra una sola vez, despues de todos los tests.
after(async () => { if (activo) await require('../../../shared/db/pool').end(); });

test('el medico receta, enfermeria confirma y Camas descuenta el stock del piso', { skip: !activo }, async (t) => {
  const pool = require('../../../shared/db/pool');
  const app = require('../../../app');
  const servidor = app.listen(0);
  await new Promise((r) => servidor.once('listening', r));
  const base = `http://127.0.0.1:${servidor.address().port}/api`;

  const marca = `rec${Date.now()}`;
  const ids = { usuarios: [], paciente: null, habitacion: null, cama: null, indicacion: null, administracion: null, inventario: null };

  t.after(async () => {
    if (ids.administracion) {
      const mov = await pool.query(
        'DELETE FROM movimientos_stock WHERE evento_origen = $1 RETURNING cantidad, inventario_piso_id',
        [String(ids.administracion)]
      );
      for (const m of mov.rows) {
        await pool.query('UPDATE inventario_piso SET stock_actual = stock_actual - $1 WHERE id = $2', [m.cantidad, m.inventario_piso_id]);
      }
      await pool.query('DELETE FROM cargos WHERE evento_origen = $1', [`medicacion_${ids.administracion}`]);
    }
    if (ids.indicacion) {
      await pool.query('DELETE FROM administraciones WHERE indicacion_id = $1', [ids.indicacion]);
      await pool.query('DELETE FROM indicaciones WHERE id = $1', [ids.indicacion]);
    }
    if (ids.paciente) {
      await pool.query('DELETE FROM cargos WHERE cuenta_id IN (SELECT id FROM cuentas WHERE paciente_id = $1)', [ids.paciente]);
      await pool.query('DELETE FROM cuentas WHERE paciente_id = $1', [ids.paciente]);
      await pool.query('DELETE FROM asignaciones_cama WHERE paciente_id = $1', [ids.paciente]);
    }
    if (ids.cama) await pool.query('DELETE FROM camas WHERE id = $1', [ids.cama]);
    if (ids.habitacion) await pool.query('DELETE FROM habitaciones WHERE id = $1', [ids.habitacion]);
    if (ids.paciente) await pool.query('DELETE FROM pacientes WHERE id = $1', [ids.paciente]);
    await pool.query('DELETE FROM usuario_rol WHERE usuario_id = ANY($1)', [ids.usuarios]);
    await pool.query('DELETE FROM usuarios WHERE id = ANY($1)', [ids.usuarios]);
    servidor.close();
  });

  async function tokenDe(rol) {
    const { rows: [u] } = await pool.query(
      `INSERT INTO usuarios (email, password_hash, nombre, apellido)
       VALUES ($1, 'x', 'Test', $2) RETURNING id`,
      [`${marca}-${rol.toLowerCase()}@test.local`, rol]
    );
    ids.usuarios.push(u.id);
    await pool.query('INSERT INTO usuario_rol (usuario_id, rol_id) SELECT $1, id FROM roles WHERE codigo = $2', [u.id, rol]);
    return jwt.sign({ id: u.id, email: 'x' }, process.env.JWT_SECRET);
  }
  const MEDICO = await tokenDe('MEDICO');
  const ENFERMERO = await tokenDe('ENFERMERO');

  const api = async (ruta, tk, method = 'GET', body) => {
    const res = await fetch(`${base}${ruta}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, datos: await res.json().catch(() => null) };
  };

  // Paciente internado en una cama propia del piso 2 (el piso 2 tiene Ibuprofeno).
  ids.paciente = (await pool.query(`INSERT INTO pacientes (nombre, apellido) VALUES ('Test', $1) RETURNING id`, [marca])).rows[0].id;
  ids.habitacion = (await pool.query(`INSERT INTO habitaciones (numero, piso, tipo, capacidad) VALUES ($1, 2, 'individual', 1) RETURNING id`, [marca.slice(-12)])).rows[0].id;
  ids.cama = (await pool.query(`INSERT INTO camas (codigo, habitacion_id) VALUES ($1, $2) RETURNING id`, [marca.slice(-12), ids.habitacion])).rows[0].id;
  await require('../../camas/servicio/camasServicio').asignar(ids.cama, { pacienteId: ids.paciente });

  // 1. El medico ve los medicamentos con el stock del piso del paciente.
  const meds = await api(`/atencion/pacientes/${ids.paciente}/medicamentos`, MEDICO);
  assert.equal(meds.status, 200);
  assert.equal(meds.datos.piso, 2);
  const ibuprofeno = meds.datos.medicamentos.find((m) => m.nombre === 'Ibuprofeno 400mg');
  assert.ok(ibuprofeno && ibuprofeno.stock > 0, 'el piso 2 tiene Ibuprofeno');
  assert.ok(meds.datos.medicamentos.every((m) => m.nombre !== 'Guantes de examen'), 'solo medicamentos');

  // Enfermeria no receta.
  assert.equal((await api(`/atencion/pacientes/${ids.paciente}/medicamentos`, ENFERMERO)).status, 403);

  // Las unidades por dosis tienen que ser un entero positivo.
  const invalida = await api('/atencion/indicaciones', MEDICO, 'POST', {
    pacienteId: ids.paciente, insumoId: ibuprofeno.id, dosis: '800 mg', cantidad: 0,
    intervaloHoras: 8, primeraDosis: new Date().toISOString(),
  });
  assert.equal(invalida.status, 400);

  // 2. El medico receta 2 unidades por dosis; la primera queda pendiente ahora.
  const receta = await api('/atencion/indicaciones', MEDICO, 'POST', {
    pacienteId: ids.paciente, insumoId: ibuprofeno.id, dosis: '800 mg por vía oral', cantidad: 2,
    intervaloHoras: 8, margenMinutos: 30, primeraDosis: new Date().toISOString(),
  });
  assert.equal(receta.status, 201);
  assert.equal(receta.datos.primeraAdministracion.cantidad, 2);
  ids.indicacion = receta.datos.id;
  ids.administracion = receta.datos.primeraAdministracion.id;

  // 3. Enfermeria confirma la dosis.
  const conf = await api(`/atencion/administraciones/${ids.administracion}/confirmar`, ENFERMERO, 'POST');
  assert.equal(conf.status, 200);

  // La dosis siguiente hereda las 2 unidades.
  const { rows: [siguiente] } = await pool.query(
    "SELECT cantidad FROM administraciones WHERE indicacion_id = $1 AND estado = 'pendiente'", [ids.indicacion]);
  assert.equal(siguiente.cantidad, 2);

  // 4. Camas descuenta 2 del piso 2 (lo hace al escuchar el evento).
  let stock;
  for (let i = 0; i < 20 && stock !== ibuprofeno.stock - 2; i++) {
    await esperar(100);
    stock = (await api(`/atencion/pacientes/${ids.paciente}/medicamentos`, MEDICO)).datos
      .medicamentos.find((m) => m.id === ibuprofeno.id).stock;
  }
  assert.equal(stock, ibuprofeno.stock - 2);
});

test('un paciente sin cama: se puede recetar, pero no hay piso del que descontar', { skip: !activo }, async (t) => {
  const pool = require('../../../shared/db/pool');
  const indicacionService = require('../servicio/indicacionService');
  const { rows: [p] } = await pool.query(`INSERT INTO pacientes (nombre, apellido) VALUES ('Test', 'SinCama') RETURNING id`);
  t.after(() => pool.query('DELETE FROM pacientes WHERE id = $1', [p.id]));

  const datos = await indicacionService.medicamentosParaPaciente(p.id);
  assert.equal(datos.piso, null);
  assert.ok(datos.medicamentos.length > 0);
  assert.ok(datos.medicamentos.every((m) => m.stock === null));
});
