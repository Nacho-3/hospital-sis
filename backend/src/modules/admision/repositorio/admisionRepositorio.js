const SELECT_TURNO = `
  SELECT t.id, t.medico_id, t.paciente_id, t.inicio, t.fin, t.estado,
         t.es_entreturno, t.duracion_reducida,
         m.nombre AS medico_nombre, m.apellido AS medico_apellido,
         p.nombre AS paciente_nombre, p.apellido AS paciente_apellido
    FROM turnos t
    JOIN usuarios m ON m.id = t.medico_id
    LEFT JOIN pacientes p ON p.id = t.paciente_id
`;

async function crearPaciente(db, { nombre, apellido, documento }) {
  const { rows } = await db.query(
    `INSERT INTO pacientes (nombre, apellido, documento)
     VALUES ($1, $2, $3)
     RETURNING id, nombre, apellido, documento`,
    [nombre, apellido, documento]
  );
  return rows[0];
}

async function listarPacientes(db) {
  const { rows } = await db.query(
    `SELECT id, nombre, apellido, documento
       FROM pacientes
      ORDER BY apellido, nombre`
  );
  return rows;
}

async function existePaciente(db, pacienteId) {
  const { rowCount } = await db.query('SELECT 1 FROM pacientes WHERE id = $1', [pacienteId]);
  return rowCount > 0;
}

async function listarMedicos(db) {
  const { rows } = await db.query(
    `SELECT u.id, u.nombre, u.apellido
       FROM usuarios u
       JOIN usuario_rol ur ON ur.usuario_id = u.id
       JOIN roles r ON r.id = ur.rol_id
      WHERE r.codigo = 'MEDICO' AND u.activo
      ORDER BY u.apellido, u.nombre`
  );
  return rows;
}

async function crearTurno(db, { medicoId, inicio, fin }) {
  const { rows } = await db.query(
    `INSERT INTO turnos (medico_id, inicio, fin)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [medicoId, inicio, fin]
  );
  return obtenerTurno(db, rows[0].id);
}

async function listarTurnos(db) {
  const { rows } = await db.query(`${SELECT_TURNO} ORDER BY t.inicio, t.id`);
  return rows;
}

async function obtenerTurno(db, turnoId) {
  const { rows } = await db.query(`${SELECT_TURNO} WHERE t.id = $1`, [turnoId]);
  return rows[0] || null;
}

// Bloqueo pesimista. La fila queda tomada hasta el COMMIT o el ROLLBACK
// de esta transaccion. La otra reserva del mismo turno espera aca.
async function bloquearTurno(db, turnoId) {
  const { rows } = await db.query(
    'SELECT id, estado, paciente_id FROM turnos WHERE id = $1 FOR UPDATE',
    [turnoId]
  );
  return rows[0] || null;
}

// El WHERE repite la condicion: solo escribe si sigue libre.
// Si la otra transaccion ya lo paso a programado, no devuelve fila.
async function marcarProgramado(db, turnoId, pacienteId) {
  const { rows } = await db.query(
    `UPDATE turnos
        SET paciente_id = $2, estado = 'programado', actualizado_en = NOW()
      WHERE id = $1 AND estado = 'disponible'
      RETURNING id`,
    [turnoId, pacienteId]
  );
  return rows[0] || null;
}

module.exports = {
  crearPaciente,
  listarPacientes,
  existePaciente,
  listarMedicos,
  crearTurno,
  listarTurnos,
  obtenerTurno,
  bloquearTurno,
  marcarProgramado,
};
