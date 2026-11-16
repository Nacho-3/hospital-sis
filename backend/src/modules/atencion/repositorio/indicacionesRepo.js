async function insertar(db, { pacienteId, medicoId, insumoId, dosis, intervaloHoras, margenMinutos }) {
  const { rows: [indicacion] } = await db.query(
    `INSERT INTO indicaciones
       (paciente_id, medico_id, insumo_id, dosis, intervalo_horas, margen_minutos)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [pacienteId, medicoId, insumoId, dosis, intervaloHoras, margenMinutos]
  );
  return indicacion;
}

module.exports = { insertar };
