// Historia clinica de punta a punta contra la base real. Solo corre con
// DB_TESTS=1, como los demas tests *.db. Crea sus datos y los borra al final
// (salvo los de la HCE: son inmutables, por eso usa un paciente propio).
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-de-test';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const activo = process.env.DB_TESTS === '1';

test('historia clinica: registros, inmutabilidad, rectificacion, permisos y datos de otros modulos', { skip: !activo }, async (t) => {
  const pool = require('../../../shared/db/pool');
  const app = require('../../../app');
  const servidor = app.listen(0);
  await new Promise((r) => servidor.once('listening', r));
  const base = `http://127.0.0.1:${servidor.address().port}/api/historia`;
  // Limpieza en orden: primero los datos de otros modulos, al final el pool.
  const limpiezas = [];
  t.after(async () => {
    for (const limpiar of limpiezas.reverse()) await limpiar();
    servidor.close();
    await pool.end();
  });

  const marca = `HC${Date.now()}`;
  // Identidad lee los permisos de la base en cada pedido: los usuarios de
  // prueba tienen roles reales (MEDICO, ENFERMERO, ADMINISTRATIVO_PISO).
  async function usuarioConRol(sufijo, rol, nombre) {
    const { rows: [u] } = await pool.query(
      `INSERT INTO usuarios (email, password_hash, nombre, apellido)
       VALUES ($1, 'x', $2, 'Test') RETURNING id`,
      [`${marca.toLowerCase()}-${sufijo}@test.local`, nombre]
    );
    await pool.query(
      'INSERT INTO usuario_rol (usuario_id, rol_id) SELECT $1, id FROM roles WHERE codigo = $2',
      [u.id, rol]
    );
    return u;
  }
  const medico = await usuarioConRol('med', 'MEDICO', 'Ana');
  const enfermero = await usuarioConRol('enf', 'ENFERMERO', 'Juan');
  const administrativo = await usuarioConRol('adm', 'ADMINISTRATIVO_PISO', 'Sol');
  const { rows: [paciente] } = await pool.query(
    `INSERT INTO pacientes (nombre, apellido, documento, fecha_nacimiento)
     VALUES ('Laura', 'Gómez', $1, '1985-03-10') RETURNING id`,
    [marca]
  );

  const token = (u) => jwt.sign({ id: u.id, email: 'x' }, process.env.JWT_SECRET);
  const MEDICO = token(medico);
  const ENFERMERO = token(enfermero);
  const pedir = async (ruta, { tk = MEDICO, method = 'GET', body } = {}) => {
    const res = await fetch(`${base}${ruta}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, datos: await res.json().catch(() => null) };
  };
  const P = `/pacientes/${paciente.id}`;

  // Registros
  const alergia = await pedir(`${P}/alergias`, { method: 'POST', body: { sustancia: 'Penicilina', severidad: 'grave', reaccion: 'Anafilaxia' } });
  assert.equal(alergia.status, 201);
  assert.equal((await pedir(`${P}/alergias`, { method: 'POST', body: { sustancia: ' PENICILINA', severidad: 'leve' } })).datos.error, 'ALERGIA_DUPLICADA');
  assert.equal((await pedir(`${P}/antecedentes`, { method: 'POST', body: { tipo: 'familiar', descripcion: 'Diabetes tipo 2', parentesco: 'madre' } })).status, 201);
  assert.equal((await pedir(`${P}/estudios`, { method: 'POST', body: { tipo: 'laboratorio', nombre: 'Hemograma', realizadoEl: '2026-11-01', resultado: 'Leucocitosis' } })).status, 201);
  const evolucion = await pedir(`${P}/evoluciones`, { method: 'POST', body: { diagnostico: 'Neumonía', texto: 'Ingresa con fiebre.' } });
  assert.equal(evolucion.status, 201);
  assert.equal(evolucion.datos.medico_id, medico.id, 'el autor sale del token, no del cuerpo');

  // Permisos: enfermeria registra pero no evoluciona ni rectifica
  assert.equal((await pedir(`${P}/antecedentes`, { tk: ENFERMERO, method: 'POST', body: { tipo: 'personal', descripcion: 'Asma' } })).status, 201);
  assert.equal((await pedir(`${P}/evoluciones`, { tk: ENFERMERO, method: 'POST', body: { texto: 'x' } })).status, 403);
  assert.equal((await pedir(`${P}/rectificaciones`, { tk: ENFERMERO, method: 'POST', body: { entidad: 'alergia', registroId: alergia.datos.id, motivo: 'x' } })).status, 403);
  assert.equal((await pedir(`${P}/alergias`, { tk: token(administrativo) })).status, 403);

  // Inmutable: la base rechaza modificar o borrar
  await assert.rejects(pool.query('UPDATE hc_evoluciones SET texto = $1 WHERE id = $2', ['otro', evolucion.datos.id]), /inmutable/);
  await assert.rejects(pool.query('DELETE FROM hc_alergias WHERE id = $1', [alergia.datos.id]), /inmutable/);

  // Rectificacion: el original queda visible y marcado; deja de ser alerta
  const rect = await pedir(`${P}/rectificaciones`, { method: 'POST', body: { entidad: 'alergia', registroId: alergia.datos.id, motivo: 'Se cargó en el paciente equivocado' } });
  assert.equal(rect.status, 201);
  assert.equal((await pedir(`${P}/rectificaciones`, { method: 'POST', body: { entidad: 'alergia', registroId: alergia.datos.id, motivo: 'otra vez' } })).datos.error, 'YA_RECTIFICADO');
  const alergias = (await pedir(`${P}/alergias`)).datos;
  assert.equal(alergias.length, 1);
  assert.equal(alergias[0].rectificacion_motivo, 'Se cargó en el paciente equivocado');
  assert.equal((await pedir(P)).datos.alergiaGrave, false);
  // Rectificar un registro de otro paciente no se puede
  const { rows: [otro] } = await pool.query(`INSERT INTO pacientes (nombre, apellido, documento) VALUES ('Otro', 'Paciente', $1) RETURNING id`, [`${marca}-2`]);
  assert.equal((await pedir(`/pacientes/${otro.id}/rectificaciones`, { method: 'POST', body: { entidad: 'evolucion', registroId: evolucion.datos.id, motivo: 'x' } })).status, 404);

  // Datos de otros modulos, solo lectura: Camas y Atencion
  const { rows: [cama] } = await pool.query(`SELECT id, codigo FROM camas WHERE estado = 'disponible' ORDER BY id LIMIT 1`);
  const { rows: [insumo] } = await pool.query(`SELECT id FROM insumos ORDER BY id LIMIT 1`);
  const { rows: [asig] } = await pool.query(`INSERT INTO asignaciones_cama (paciente_id, cama_id, motivo) VALUES ($1, $2, 'Neumonía') RETURNING id`, [paciente.id, cama.id]);
  await pool.query(`UPDATE camas SET estado = 'ocupada' WHERE id = $1`, [cama.id]);
  const { rows: [sv] } = await pool.query(
    `INSERT INTO signos_vitales (paciente_id, enfermero_id, cama_id, presion_sistolica, presion_diastolica, frecuencia_cardiaca, temperatura, fuera_de_rango)
     VALUES ($1, $2, $3, 120, 80, 95, 39.4, TRUE) RETURNING id`,
    [paciente.id, medico.id, cama.id]
  );
  const { rows: [ind] } = await pool.query(
    `INSERT INTO indicaciones (paciente_id, medico_id, insumo_id, dosis, intervalo_horas) VALUES ($1, $2, $3, '400 mg', 8) RETURNING id`,
    [paciente.id, medico.id, insumo.id]
  );
  const { rows: [adm] } = await pool.query(
    `INSERT INTO administraciones (indicacion_id, enfermero_id, programada_para, administrada_en, estado)
     VALUES ($1, $2, NOW(), NOW(), 'administrada') RETURNING id`,
    [ind.id, medico.id]
  );
  limpiezas.push(async () => {
    await pool.query('DELETE FROM administraciones WHERE id = $1', [adm.id]);
    await pool.query('DELETE FROM indicaciones WHERE id = $1', [ind.id]);
    await pool.query('DELETE FROM signos_vitales WHERE id = $1', [sv.id]);
    await pool.query('DELETE FROM asignaciones_cama WHERE id = $1', [asig.id]);
    await pool.query(`UPDATE camas SET estado = 'disponible' WHERE id = $1`, [cama.id]);
  });

  const resumen = (await pedir(P)).datos;
  assert.equal(resumen.paciente.apellido, 'Gómez');
  assert.equal(resumen.internacionActual.codigo, cama.codigo);
  assert.equal(Number(resumen.ultimosSignos.temperatura), 39.4);

  const linea = (await pedir(`${P}/linea-de-tiempo`)).datos;
  const origenes = new Set(linea.map((e) => e.origen));
  for (const o of ['Historia clínica', 'Atención', 'Camas']) assert.ok(origenes.has(o), `falta ${o} en la línea de tiempo`);
  assert.ok(linea.some((e) => e.tipo === 'administracion'));
  assert.ok(linea.some((e) => e.tipo === 'signos' && e.alerta));

  // Buscador
  const encontrados = (await pedir(`/pacientes?buscar=${marca}`)).datos;
  assert.ok(encontrados.some((x) => x.id === paciente.id));
  assert.ok((await pedir('/pacientes?buscar=Gómez')).datos.some((x) => x.id === paciente.id));
  assert.equal((await pedir('/pacientes?buscar=a')).status, 400);
});
