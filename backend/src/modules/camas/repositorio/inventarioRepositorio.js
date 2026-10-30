// Acceso a datos de insumos, inventario por piso y movimientos de stock.
// Cada funcion recibe `db`: el pool o el client de una transaccion.

const SELECT_INVENTARIO = `
  SELECT
    ip.id,
    ip.piso,
    ip.insumo_id,
    i.nombre AS insumo,
    i.categoria,
    i.unidad_medida,
    ip.stock_actual,
    ip.stock_minimo,
    (ip.stock_actual <= ip.stock_minimo) AS stock_bajo,
    ip.actualizado_en
  FROM inventario_piso ip
  JOIN insumos i ON i.id = ip.insumo_id
`;

async function listarInventario(db, { piso, soloBajo = false } = {}) {
  const condiciones = [];
  const valores = [];
  if (piso !== undefined) {
    valores.push(piso);
    condiciones.push(`ip.piso = $${valores.length}`);
  }
  if (soloBajo) condiciones.push('ip.stock_actual <= ip.stock_minimo');
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const { rows } = await db.query(`${SELECT_INVENTARIO} ${where} ORDER BY ip.piso, i.nombre`, valores);
  return rows;
}

async function obtenerInventario(db, id) {
  const { rows } = await db.query(`${SELECT_INVENTARIO} WHERE ip.id = $1`, [id]);
  return rows[0] || null;
}

async function buscarInventario(db, piso, insumoId) {
  const { rows } = await db.query(
    `${SELECT_INVENTARIO} WHERE ip.piso = $1 AND ip.insumo_id = $2`,
    [piso, insumoId]
  );
  return rows[0] || null;
}

// Descuento atomico (HU 3.1): una sola sentencia que resta solo si alcanza.
// Dos descuentos simultaneos del mismo insumo se ordenan solos por el lock
// de fila del UPDATE, y ninguno lee un stock viejo. Si no alcanza, no
// devuelve fila y el stock queda como estaba.
async function descontar(db, inventarioId, cantidad) {
  const { rows } = await db.query(
    `UPDATE inventario_piso
        SET stock_actual = stock_actual - $2, actualizado_en = NOW()
      WHERE id = $1 AND stock_actual >= $2
      RETURNING *`,
    [inventarioId, cantidad]
  );
  return rows[0] || null;
}

async function sumar(db, inventarioId, cantidad) {
  const { rows } = await db.query(
    `UPDATE inventario_piso
        SET stock_actual = stock_actual + $2, actualizado_en = NOW()
      WHERE id = $1
      RETURNING *`,
    [inventarioId, cantidad]
  );
  return rows[0] || null;
}

async function registrarMovimiento(db, { inventarioPisoId, cantidad, stockResultante, motivo, eventoOrigen = null, pacienteId = null }) {
  const { rows } = await db.query(
    `INSERT INTO movimientos_stock
       (inventario_piso_id, cantidad, stock_resultante, motivo, evento_origen, paciente_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [inventarioPisoId, cantidad, stockResultante, motivo, eventoOrigen, pacienteId]
  );
  return rows[0];
}

async function movimientoPorEvento(db, eventoOrigen) {
  const { rows } = await db.query(
    'SELECT * FROM movimientos_stock WHERE evento_origen = $1',
    [eventoOrigen]
  );
  return rows[0] || null;
}

async function movimientos(db, inventarioId) {
  const { rows } = await db.query(
    `SELECT m.*, p.nombre AS paciente_nombre, p.apellido AS paciente_apellido
       FROM movimientos_stock m
       LEFT JOIN pacientes p ON p.id = m.paciente_id
      WHERE m.inventario_piso_id = $1
      ORDER BY m.creado_en DESC, m.id DESC
      LIMIT 100`,
    [inventarioId]
  );
  return rows;
}

// Piso donde esta internado el paciente, segun su asignacion de cama vigente.
async function pisoDePaciente(db, pacienteId) {
  const { rows } = await db.query(
    `SELECT h.piso
       FROM asignaciones_cama a
       JOIN camas c ON c.id = a.cama_id
       JOIN habitaciones h ON h.id = c.habitacion_id
      WHERE a.paciente_id = $1 AND a.fecha_hora_egreso IS NULL`,
    [pacienteId]
  );
  return rows[0] ? rows[0].piso : null;
}

async function obtenerInsumo(db, insumoId) {
  const { rows } = await db.query('SELECT * FROM insumos WHERE id = $1', [insumoId]);
  return rows[0] || null;
}

async function listarInsumos(db) {
  const { rows } = await db.query('SELECT * FROM insumos ORDER BY nombre');
  return rows;
}

async function crearInsumo(db, { nombre, categoria, unidadMedida }) {
  const { rows } = await db.query(
    `INSERT INTO insumos (nombre, categoria, unidad_medida)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [nombre, categoria, unidadMedida]
  );
  return rows[0];
}

// Alta del par piso + insumo, o cambio del stock minimo si ya existe.
// El stock inicial solo se usa al crear: despues el stock cambia por movimientos.
async function configurarInventario(db, { piso, insumoId, stockInicial, stockMinimo }) {
  const { rows } = await db.query(
    `INSERT INTO inventario_piso (piso, insumo_id, stock_actual, stock_minimo)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (piso, insumo_id)
       DO UPDATE SET stock_minimo = EXCLUDED.stock_minimo, actualizado_en = NOW()
     RETURNING *, (xmax = 0) AS creado`,
    [piso, insumoId, stockInicial, stockMinimo]
  );
  return rows[0];
}

module.exports = {
  listarInventario,
  obtenerInventario,
  buscarInventario,
  descontar,
  sumar,
  registrarMovimiento,
  movimientoPorEvento,
  movimientos,
  pisoDePaciente,
  obtenerInsumo,
  listarInsumos,
  crearInsumo,
  configurarInventario,
};
