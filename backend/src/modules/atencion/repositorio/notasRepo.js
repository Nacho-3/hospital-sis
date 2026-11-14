async function insertar(db, { pacienteId, enfermeroId, signosVitalesId = null, texto, automatica = false }) {
  const { rows } = await db.query(
    `INSERT INTO notas_enfermeria (paciente_id, enfermero_id, signos_vitales_id, texto, automatica)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`, [pacienteId, enfermeroId, signosVitalesId, texto, automatica]);
  return rows[0];
}
// indicacionesRepo.js -> insertar({pacienteId, medicoId, insumoId, dosis, intervaloHoras, margenMinutos}), buscarPorId
// protocolosRepo.js
async function insertarConTareas(db, pacienteId, { tipo, tareas }) {
  const { rows: [p] } = await db.query(
    `INSERT INTO protocolos (paciente_id, tipo) VALUES ($1,$2) RETURNING *`, [pacienteId, tipo]);
  for (const t of tareas)
    await db.query(`INSERT INTO protocolo_tareas (protocolo_id, descripcion) VALUES ($1,$2)`, [p.id, t.descripcion]);
  return { ...p, tareas };
}
// + listarPorPaciente(db, pacienteId) y marcarTareaRealizada(db, tareaId)