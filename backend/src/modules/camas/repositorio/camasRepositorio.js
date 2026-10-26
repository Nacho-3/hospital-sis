// Acceso a datos de habitaciones, camas y asignaciones.
// Cada funcion recibe `db`: el pool o el client de una transaccion.

const SELECT_MAPA = `
  SELECT
    c.id,
    c.codigo,
    c.estado,
    c.actualizado_en,
    h.id AS habitacion_id,
    h.numero AS habitacion,
    h.piso,
    h.tipo,
    h.capacidad,
    a.id AS asignacion_id,
    a.fecha_hora_ingreso,
    a.motivo,
    p.id AS paciente_id,
    p.nombre AS paciente_nombre,
    p.apellido AS paciente_apellido,
    r.id AS reservada_para_paciente_id,
    r.nombre AS reservada_para_nombre,
    r.apellido AS reservada_para_apellido
  FROM camas c
  JOIN habitaciones h ON h.id = c.habitacion_id
  LEFT JOIN asignaciones_cama a ON a.cama_id = c.id AND a.fecha_hora_egreso IS NULL
  LEFT JOIN pacientes p ON p.id = a.paciente_id
  LEFT JOIN pacientes r ON r.id = c.reservada_para_paciente_id
`;

async function listarMapa(db, { piso, estado } = {}) {
  const condiciones = [];
  const valores = [];
  if (piso !== undefined) {
    valores.push(piso);
    condiciones.push(`h.piso = $${valores.length}`);
  }
  if (estado !== undefined) {
    valores.push(estado);
    condiciones.push(`c.estado = $${valores.length}`);
  }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const { rows } = await db.query(
    `${SELECT_MAPA} ${where} ORDER BY h.piso, h.numero, c.codigo`,
    valores
  );
  return rows;
}

async function obtenerDetalle(db, camaId) {
  const { rows } = await db.query(`${SELECT_MAPA} WHERE c.id = $1`, [camaId]);
  return rows[0] || null;
}

// Bloqueo pesimista: la fila queda tomada hasta el COMMIT o ROLLBACK.
// Una segunda transaccion que pida la misma cama espera aca y, cuando entra,
// ya lee el estado que dejo la primera.
async function bloquearCama(db, camaId) {
  const { rows } = await db.query(
    'SELECT * FROM camas WHERE id = $1 FOR UPDATE',
    [camaId]
  );
  return rows[0] || null;
}

// Para operaciones sobre dos camas (traslado): se bloquean siempre en orden
// de id para que dos traslados cruzados no se traben entre si (deadlock).
async function bloquearCamas(db, ids) {
  const { rows } = await db.query(
    'SELECT * FROM camas WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE',
    [ids]
  );
  return rows;
}

async function guardarEstado(db, cama) {
  await db.query(
    `UPDATE camas
       SET estado = $2, reservada_para_paciente_id = $3, actualizado_en = NOW()
     WHERE id = $1`,
    [cama.id, cama.nombreEstado, cama.reservadaPara]
  );
}

async function existePaciente(db, pacienteId) {
  const { rowCount } = await db.query('SELECT 1 FROM pacientes WHERE id = $1', [pacienteId]);
  return rowCount > 0;
}

async function asignacionVigenteDePaciente(db, pacienteId) {
  const { rows } = await db.query(
    `SELECT * FROM asignaciones_cama
      WHERE paciente_id = $1 AND fecha_hora_egreso IS NULL`,
    [pacienteId]
  );
  return rows[0] || null;
}

async function asignacionVigenteDeCama(db, camaId) {
  const { rows } = await db.query(
    `SELECT * FROM asignaciones_cama
      WHERE cama_id = $1 AND fecha_hora_egreso IS NULL`,
    [camaId]
  );
  return rows[0] || null;
}

async function crearAsignacion(db, { camaId, pacienteId, motivo }) {
  const { rows } = await db.query(
    `INSERT INTO asignaciones_cama (cama_id, paciente_id, motivo)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [camaId, pacienteId, motivo || null]
  );
  return rows[0];
}

async function cerrarAsignacion(db, asignacionId, motivoEgreso) {
  const { rows } = await db.query(
    `UPDATE asignaciones_cama
        SET fecha_hora_egreso = NOW(), motivo_egreso = $2
      WHERE id = $1 AND fecha_hora_egreso IS NULL
      RETURNING *`,
    [asignacionId, motivoEgreso]
  );
  return rows[0] || null;
}

async function historialDeCama(db, camaId) {
  const { rows } = await db.query(
    `SELECT a.*, p.nombre AS paciente_nombre, p.apellido AS paciente_apellido
       FROM asignaciones_cama a
       JOIN pacientes p ON p.id = a.paciente_id
      WHERE a.cama_id = $1
      ORDER BY a.fecha_hora_ingreso DESC`,
    [camaId]
  );
  return rows;
}

// Lectura de pacientes (la tabla la escribe Admision; aca solo se consulta).
async function pacientesSinCama(db) {
  const { rows } = await db.query(
    `SELECT p.id, p.nombre, p.apellido, p.documento
       FROM pacientes p
      WHERE NOT EXISTS (
        SELECT 1 FROM asignaciones_cama a
         WHERE a.paciente_id = p.id AND a.fecha_hora_egreso IS NULL
      )
      ORDER BY p.apellido, p.nombre`
  );
  return rows;
}

async function listarHabitaciones(db) {
  const { rows } = await db.query(
    `SELECT h.*, COUNT(c.id)::int AS camas
       FROM habitaciones h
       LEFT JOIN camas c ON c.habitacion_id = h.id
      GROUP BY h.id
      ORDER BY h.piso, h.numero`
  );
  return rows;
}

async function crearHabitacion(db, { numero, piso, tipo, capacidad }) {
  const { rows } = await db.query(
    `INSERT INTO habitaciones (numero, piso, tipo, capacidad)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [numero, piso, tipo, capacidad]
  );
  return rows[0];
}

async function bloquearHabitacion(db, habitacionId) {
  const { rows } = await db.query(
    'SELECT * FROM habitaciones WHERE id = $1 FOR UPDATE',
    [habitacionId]
  );
  return rows[0] || null;
}

async function contarCamas(db, habitacionId) {
  const { rows } = await db.query(
    'SELECT COUNT(*)::int AS total FROM camas WHERE habitacion_id = $1',
    [habitacionId]
  );
  return rows[0].total;
}

async function crearCama(db, { codigo, habitacionId }) {
  const { rows } = await db.query(
    `INSERT INTO camas (codigo, habitacion_id) VALUES ($1, $2) RETURNING *`,
    [codigo, habitacionId]
  );
  return rows[0];
}

module.exports = {
  listarMapa,
  obtenerDetalle,
  bloquearCama,
  bloquearCamas,
  guardarEstado,
  existePaciente,
  asignacionVigenteDePaciente,
  asignacionVigenteDeCama,
  crearAsignacion,
  cerrarAsignacion,
  historialDeCama,
  pacientesSinCama,
  listarHabitaciones,
  crearHabitacion,
  bloquearHabitacion,
  contarCamas,
  crearCama,
};
