async function insertar(db, s) {
  const { rows } = await db.query(
    `INSERT INTO signos_vitales
       (paciente_id, enfermero_id, cama_id, presion_sistolica, presion_diastolica,
        frecuencia_cardiaca, temperatura, fuera_de_rango)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [s.pacienteId, s.enfermeroId, s.camaId ?? null, s.presionSistolica ?? null,
     s.presionDiastolica ?? null, s.frecuenciaCardiaca ?? null, s.temperatura ?? null, s.fueraDeRango]);
  return aDominio(rows[0]);
}
async function listarPorPaciente(db, pacienteId, limite = 50) {
  const { rows } = await db.query(
    `SELECT * FROM signos_vitales WHERE paciente_id = $1 ORDER BY registrado_en DESC LIMIT $2`,
    [pacienteId, limite]);
  return rows.map(aDominio);
}
const aDominio = (r) => ({
  id: r.id, pacienteId: r.paciente_id, enfermeroId: r.enfermero_id, camaId: r.cama_id,
  presionSistolica: r.presion_sistolica, presionDiastolica: r.presion_diastolica,
  frecuenciaCardiaca: r.frecuencia_cardiaca,
  temperatura: r.temperatura == null ? null : Number(r.temperatura),
  fueraDeRango: r.fuera_de_rango, registradoEn: r.registrado_en,
});
module.exports = { insertar, listarPorPaciente };