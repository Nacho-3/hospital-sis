const SELECT_AVISO = `
  SELECT a.id, a.tipo, a.paciente_id, a.turno_id, a.medico_id, a.creado_en,
         p.nombre AS paciente_nombre, p.apellido AS paciente_apellido,
         m.nombre AS medico_nombre, m.apellido AS medico_apellido
    FROM avisos_clinicos a
    JOIN pacientes p ON p.id = a.paciente_id
    LEFT JOIN usuarios m ON m.id = a.medico_id
`;

async function insertar(db, { tipo, pacienteId, turnoId = null, medicoId = null }) {
  const { rows } = await db.query(
    `INSERT INTO avisos_clinicos (tipo, paciente_id, turno_id, medico_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [tipo, pacienteId, turnoId, medicoId]
  );
  const { rows: avisos } = await db.query(`${SELECT_AVISO} WHERE a.id = $1`, [rows[0].id]);
  return avisos[0];
}

async function listarAbiertos(db) {
  const { rows } = await db.query(
    `${SELECT_AVISO}
      WHERE a.cerrado_en IS NULL
      ORDER BY a.creado_en, a.id`
  );
  return rows;
}

async function cerrar(db, id) {
  const { rows } = await db.query(
    `UPDATE avisos_clinicos
        SET cerrado_en = NOW()
      WHERE id = $1 AND cerrado_en IS NULL
      RETURNING id`,
    [id]
  );
  return rows[0] || null;
}

module.exports = { insertar, listarAbiertos, cerrar };
