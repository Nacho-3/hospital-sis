async function buscarParaActualizar(db, id) {
  const { rows } = await db.query(
    `SELECT a.*, i.paciente_id, i.insumo_id, i.intervalo_horas, i.margen_minutos,
            i.activa AS indicacion_activa
       FROM administraciones a
       JOIN indicaciones i ON i.id = a.indicacion_id
      WHERE a.id = $1
        FOR UPDATE OF a`,                       // bloquea la fila: evita doble confirmación
    [id]);
  return rows[0];
}
async function marcarAdministrada(db, id, enfermeroId, cuando) {
  await db.query(
    `UPDATE administraciones SET estado='administrada', enfermero_id=$2, administrada_en=$3 WHERE id=$1`,
    [id, enfermeroId, cuando]);
}
async function insertar(db, { indicacionId, programadaPara, cantidad = 1 }) {
  const { rows } = await db.query(
    `INSERT INTO administraciones (indicacion_id, programada_para, cantidad)
     VALUES ($1,$2,$3) RETURNING *`, [indicacionId, programadaPara, cantidad]);
  return rows[0];
}
async function listarPendientes(db, { pacienteId, hasta }) {
  const { rows } = await db.query(
    `SELECT a.*, i.dosis, i.insumo_id, i.paciente_id, i.margen_minutos,
            ins.nombre AS insumo_nombre
       FROM administraciones a
       JOIN indicaciones i ON i.id = a.indicacion_id
       JOIN insumos ins ON ins.id = i.insumo_id
      WHERE a.estado = 'pendiente' AND i.activa
        AND ($1::int IS NULL OR i.paciente_id = $1)
        AND a.programada_para <= $2
      ORDER BY a.programada_para`, [pacienteId ?? null, hasta]);
  return rows;
}
module.exports = { buscarParaActualizar, marcarAdministrada, insertar, listarPendientes };