async function insertar(db, { pacienteId, enfermeroId, signosVitalesId = null, texto, automatica = false }) {
  const { rows } = await db.query(
    `INSERT INTO notas_enfermeria (paciente_id, enfermero_id, signos_vitales_id, texto, automatica)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`, [pacienteId, enfermeroId, signosVitalesId, texto, automatica]);
  return rows[0];
}
async function listarPorPaciente(db, pacienteId) {
  const { rows } = await db.query(
    `SELECT id, paciente_id, enfermero_id, signos_vitales_id, texto, automatica, creado_en
       FROM notas_enfermeria
      WHERE paciente_id = $1
      ORDER BY creado_en DESC, id DESC
      LIMIT 100`,
    [pacienteId]
  );
  return rows;
}

module.exports = { insertar, listarPorPaciente };