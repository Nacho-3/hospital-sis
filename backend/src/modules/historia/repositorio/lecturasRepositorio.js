// Lecturas de tablas de OTROS modulos, para mostrarlas en la historia clinica.
// Solo SELECT: la HCE nunca escribe en tablas ajenas. Los modulos dueños
// (Admision, Camas, Atencion) siguen funcionando igual y muestran estos datos
// en sus propias pantallas; la HCE ademas los junta en un solo lugar.
//
// Si un modulo cambia una de estas columnas, hay que ajustar la consulta aca.

const LIMITE = 200;

// Admision: ficha demografica.
async function paciente(db, pacienteId) {
  const { rows } = await db.query(
    `SELECT id, nombre, apellido, documento, fecha_nacimiento, telefono, creado_en
       FROM pacientes WHERE id = $1`,
    [pacienteId]
  );
  return rows[0] || null;
}

async function buscarPacientes(db, termino) {
  const like = `%${termino.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const { rows } = await db.query(
    `SELECT id, nombre, apellido, documento, fecha_nacimiento
       FROM pacientes
      WHERE nombre ILIKE $1 OR apellido ILIKE $1 OR documento ILIKE $1
         OR (nombre || ' ' || apellido) ILIKE $1 OR (apellido || ' ' || nombre) ILIKE $1
      ORDER BY apellido, nombre
      LIMIT 20`,
    [like]
  );
  return rows;
}

// Admision: turnos del paciente.
async function turnos(db, pacienteId) {
  const { rows } = await db.query(
    `SELECT t.inicio, t.estado, m.nombre AS medico_nombre, m.apellido AS medico_apellido
       FROM turnos t
       JOIN usuarios m ON m.id = t.medico_id
      WHERE t.paciente_id = $1
      ORDER BY t.inicio DESC
      LIMIT ${LIMITE}`,
    [pacienteId]
  );
  return rows;
}

// Camas: internaciones (asignaciones de cama), vigente y anteriores.
async function internaciones(db, pacienteId) {
  const { rows } = await db.query(
    `SELECT a.fecha_hora_ingreso, a.fecha_hora_egreso, a.motivo, a.motivo_egreso,
            c.codigo, h.numero AS habitacion, h.piso
       FROM asignaciones_cama a
       JOIN camas c ON c.id = a.cama_id
       JOIN habitaciones h ON h.id = c.habitacion_id
      WHERE a.paciente_id = $1
      ORDER BY a.fecha_hora_ingreso DESC
      LIMIT ${LIMITE}`,
    [pacienteId]
  );
  return rows;
}

// Atencion: signos vitales.
async function signosVitales(db, pacienteId) {
  const { rows } = await db.query(
    `SELECT s.registrado_en, s.presion_sistolica, s.presion_diastolica,
            s.frecuencia_cardiaca, s.temperatura, s.fuera_de_rango,
            u.nombre AS autor_nombre, u.apellido AS autor_apellido
       FROM signos_vitales s
       JOIN usuarios u ON u.id = s.enfermero_id
      WHERE s.paciente_id = $1
      ORDER BY s.registrado_en DESC
      LIMIT ${LIMITE}`,
    [pacienteId]
  );
  return rows;
}

// Atencion: notas de enfermeria.
async function notas(db, pacienteId) {
  const { rows } = await db.query(
    `SELECT n.creado_en, n.texto, n.automatica,
            u.nombre AS autor_nombre, u.apellido AS autor_apellido
       FROM notas_enfermeria n
       JOIN usuarios u ON u.id = n.enfermero_id
      WHERE n.paciente_id = $1
      ORDER BY n.creado_en DESC
      LIMIT ${LIMITE}`,
    [pacienteId]
  );
  return rows;
}

// Atencion: indicaciones medicas (prescripciones).
async function indicaciones(db, pacienteId) {
  const { rows } = await db.query(
    `SELECT i.creado_en, i.dosis, i.intervalo_horas, i.activa, ins.nombre AS insumo,
            u.nombre AS autor_nombre, u.apellido AS autor_apellido
       FROM indicaciones i
       JOIN insumos ins ON ins.id = i.insumo_id
       JOIN usuarios u ON u.id = i.medico_id
      WHERE i.paciente_id = $1
      ORDER BY i.creado_en DESC
      LIMIT ${LIMITE}`,
    [pacienteId]
  );
  return rows;
}

// Atencion: dosis efectivamente administradas.
async function administraciones(db, pacienteId) {
  const { rows } = await db.query(
    `SELECT a.administrada_en, a.cantidad, ins.nombre AS insumo, ins.unidad_medida,
            u.nombre AS autor_nombre, u.apellido AS autor_apellido
       FROM administraciones a
       JOIN indicaciones i ON i.id = a.indicacion_id
       JOIN insumos ins ON ins.id = i.insumo_id
       LEFT JOIN usuarios u ON u.id = a.enfermero_id
      WHERE i.paciente_id = $1 AND a.estado = 'administrada'
      ORDER BY a.administrada_en DESC
      LIMIT ${LIMITE}`,
    [pacienteId]
  );
  return rows;
}

// Atencion: protocolos de ingreso (Builder) y su avance.
async function protocolos(db, pacienteId) {
  const { rows } = await db.query(
    `SELECT p.creado_en, p.tipo,
            COUNT(t.id)::int AS total,
            COUNT(t.id) FILTER (WHERE t.estado = 'realizada')::int AS realizadas
       FROM protocolos p
       LEFT JOIN protocolo_tareas t ON t.protocolo_id = p.id
      WHERE p.paciente_id = $1
      GROUP BY p.id
      ORDER BY p.creado_en DESC
      LIMIT ${LIMITE}`,
    [pacienteId]
  );
  return rows;
}

module.exports = {
  paciente,
  buscarPacientes,
  turnos,
  internaciones,
  signosVitales,
  notas,
  indicaciones,
  administraciones,
  protocolos,
};
