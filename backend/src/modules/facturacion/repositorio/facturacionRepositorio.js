// Acceso a datos de Facturacion. Aca vive todo el SQL del modulo.
// Cada funcion recibe `db`: el pool o el client de una transaccion.
// Los NUMERIC se piden como float8 para que lleguen como numero y no como texto.

// ---------- Lectura de tablas de otros modulos (no se escriben) ----------

// pacientes es de Admision.
async function obtenerPaciente(db, pacienteId) {
  const { rows } = await db.query(
    'SELECT id, nombre, apellido FROM pacientes WHERE id = $1',
    [pacienteId]
  );
  return rows[0] || null;
}

// ---------- Coberturas ----------

const SELECT_COBERTURA = 'SELECT c.id, c.nombre, c.tipo, c.copago_fijo::float8 AS copago_fijo FROM coberturas c';

async function listarCoberturas(db) {
  const { rows } = await db.query(`${SELECT_COBERTURA} ORDER BY c.nombre`);
  return rows;
}

async function obtenerCobertura(db, coberturaId) {
  const { rows } = await db.query(`${SELECT_COBERTURA} WHERE c.id = $1`, [coberturaId]);
  return rows[0] || null;
}

// vigente_hasta NULL = vigente. El indice unico parcial garantiza una sola por paciente.
async function coberturaVigenteDePaciente(db, pacienteId) {
  const { rows } = await db.query(
    `${SELECT_COBERTURA}
       JOIN paciente_cobertura pc ON pc.cobertura_id = c.id
      WHERE pc.paciente_id = $1 AND pc.vigente_hasta IS NULL`,
    [pacienteId]
  );
  return rows[0] || null;
}

async function cerrarCoberturaVigente(db, pacienteId) {
  await db.query(
    `UPDATE paciente_cobertura
        SET vigente_hasta = CURRENT_DATE
      WHERE paciente_id = $1 AND vigente_hasta IS NULL`,
    [pacienteId]
  );
}

async function abrirCobertura(db, pacienteId, coberturaId) {
  await db.query(
    'INSERT INTO paciente_cobertura (paciente_id, cobertura_id) VALUES ($1, $2)',
    [pacienteId, coberturaId]
  );
}

// ---------- Precios de insumos ----------

// Ultimo precio que ya entro en vigencia, por insumo. insumos es de Camas: solo se lee el nombre.
const SELECT_PRECIOS_VIGENTES = `
  SELECT DISTINCT ON (pi.insumo_id)
         pi.insumo_id, i.nombre AS insumo, pi.precio::float8 AS precio,
         to_char(pi.vigente_desde, 'YYYY-MM-DD') AS vigente_desde
    FROM precios_insumo pi
    JOIN insumos i ON i.id = pi.insumo_id
   WHERE pi.vigente_desde <= CURRENT_DATE
`;
const ORDEN_PRECIOS_VIGENTES = 'ORDER BY pi.insumo_id, pi.vigente_desde DESC, pi.id DESC';

async function listarPreciosVigentes(db) {
  const { rows } = await db.query(`${SELECT_PRECIOS_VIGENTES} ${ORDEN_PRECIOS_VIGENTES}`);
  return rows;
}

async function precioVigenteDeInsumo(db, insumoId) {
  const { rows } = await db.query(
    `${SELECT_PRECIOS_VIGENTES} AND pi.insumo_id = $1 ${ORDEN_PRECIOS_VIGENTES}`,
    [insumoId]
  );
  return rows[0] || null;
}

// ---------- Cuentas y cargos ----------

async function cuentaActiva(db, pacienteId) {
  const { rows } = await db.query(
    `SELECT id, paciente_id, estado, abierta_en
       FROM cuentas
      WHERE paciente_id = $1 AND estado = 'activa'`,
    [pacienteId]
  );
  return rows[0] || null;
}

// Devuelve el id de la cuenta activa del paciente y la abre si no tenia.
// Si dos transacciones la abren a la vez, ON CONFLICT hace que la segunda
// espere a la primera y no inserte: despues lee la que ya quedo creada.
async function obtenerOCrearCuentaActiva(db, pacienteId) {
  const existente = await cuentaActiva(db, pacienteId);
  if (existente) return existente.id;

  const { rows } = await db.query(
    `INSERT INTO cuentas (paciente_id)
     VALUES ($1)
     ON CONFLICT (paciente_id) WHERE estado = 'activa' DO NOTHING
     RETURNING id`,
    [pacienteId]
  );
  if (rows[0]) return rows[0].id;
  return (await cuentaActiva(db, pacienteId)).id;
}

const COLUMNAS_CARGO = `
  id, cuenta_id, concepto, monto::float8 AS monto, destinatario,
  destinatario_nombre, insumo_id, evento_origen, creado_en
`;

async function cargosDeCuenta(db, cuentaId) {
  const { rows } = await db.query(
    `SELECT ${COLUMNAS_CARGO}
       FROM cargos
      WHERE cuenta_id = $1
      ORDER BY creado_en DESC, id DESC`,
    [cuentaId]
  );
  return rows;
}

async function insertarCargo(db, { cuentaId, concepto, monto, destinatario, destinatarioNombre, insumoId = null, eventoOrigen = null }) {
  const { rows } = await db.query(
    `INSERT INTO cargos
       (cuenta_id, concepto, monto, destinatario, destinatario_nombre, insumo_id, evento_origen)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${COLUMNAS_CARGO}`,
    [cuentaId, concepto, monto, destinatario, destinatarioNombre, insumoId, eventoOrigen]
  );
  return rows[0];
}

async function existenCargosDeEvento(db, eventoOrigen) {
  const { rows } = await db.query(
    'SELECT 1 FROM cargos WHERE evento_origen = $1 LIMIT 1',
    [eventoOrigen]
  );
  return rows.length > 0;
}

module.exports = {
  obtenerPaciente,
  listarCoberturas,
  obtenerCobertura,
  coberturaVigenteDePaciente,
  cerrarCoberturaVigente,
  abrirCobertura,
  listarPreciosVigentes,
  precioVigenteDeInsumo,
  cuentaActiva,
  obtenerOCrearCuentaActiva,
  cargosDeCuenta,
  insertarCargo,
  existenCargosDeEvento,
};
