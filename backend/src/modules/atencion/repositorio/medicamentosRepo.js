// Piso donde esta internado el paciente (asignacion vigente en Camas), o null.
async function pisoDelPaciente(db, pacienteId) {
  const { rows: [fila] } = await db.query(
    `SELECT h.piso
       FROM asignaciones_cama a
       JOIN camas c ON c.id = a.cama_id
       JOIN habitaciones h ON h.id = c.habitacion_id
      WHERE a.paciente_id = $1 AND a.fecha_hora_egreso IS NULL`,
    [pacienteId]
  );
  return fila ? fila.piso : null;
}

// Medicamentos que se pueden recetar, con el stock del piso indicado (null si
// ese piso no tiene el insumo o si no hay piso).
async function listarConStock(db, piso) {
  const { rows } = await db.query(
    `SELECT i.id, i.nombre, i.unidad_medida, ip.stock_actual
       FROM insumos i
       LEFT JOIN inventario_piso ip ON ip.insumo_id = i.id AND ip.piso = $1
      WHERE i.categoria = 'medicamento'
      ORDER BY i.nombre`,
    [piso]
  );
  return rows;
}

module.exports = { pisoDelPaciente, listarConStock };
