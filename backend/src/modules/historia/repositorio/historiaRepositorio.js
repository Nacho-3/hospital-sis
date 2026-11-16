// Tablas propias de la HCE. Solo INSERT y SELECT: la base rechaza UPDATE y
// DELETE (trigger hc_rechazar_cambios en 60-historia-clinica.sql).
// Cada funcion recibe `db`: el pool o el client de una transaccion.

const TABLAS = {
  alergia: 'hc_alergias',
  antecedente: 'hc_antecedentes',
  evolucion: 'hc_evoluciones',
  estudio: 'hc_estudios',
};

// Columnas comunes al leer un registro: autor y, si existe, su rectificacion.
function selectConRectificacion(entidad, columnaAutor) {
  return `
    SELECT t.*,
           u.nombre AS autor_nombre,
           u.apellido AS autor_apellido,
           r.id AS rectificacion_id,
           r.motivo AS rectificacion_motivo,
           r.registrado_en AS rectificado_en,
           ru.nombre AS rectificado_por_nombre,
           ru.apellido AS rectificado_por_apellido
      FROM ${TABLAS[entidad]} t
      JOIN usuarios u ON u.id = t.${columnaAutor}
      LEFT JOIN hc_rectificaciones r ON r.entidad = '${entidad}' AND r.registro_id = t.id
      LEFT JOIN usuarios ru ON ru.id = r.registrado_por
     WHERE t.paciente_id = $1`;
}

async function listarAlergias(db, pacienteId) {
  const { rows } = await db.query(
    `${selectConRectificacion('alergia', 'registrado_por')}
     ORDER BY (r.id IS NULL) DESC,
              CASE t.severidad WHEN 'grave' THEN 0 WHEN 'moderada' THEN 1 ELSE 2 END,
              t.registrado_en DESC`,
    [pacienteId]
  );
  return rows;
}

async function listarAntecedentes(db, pacienteId) {
  const { rows } = await db.query(
    `${selectConRectificacion('antecedente', 'registrado_por')} ORDER BY t.tipo, t.registrado_en DESC`,
    [pacienteId]
  );
  return rows;
}

async function listarEvoluciones(db, pacienteId) {
  const { rows } = await db.query(
    `${selectConRectificacion('evolucion', 'medico_id')} ORDER BY t.registrado_en DESC`,
    [pacienteId]
  );
  return rows;
}

async function listarEstudios(db, pacienteId) {
  const { rows } = await db.query(
    `${selectConRectificacion('estudio', 'registrado_por')} ORDER BY t.realizado_el DESC, t.registrado_en DESC`,
    [pacienteId]
  );
  return rows;
}

async function insertarAlergia(db, pacienteId, usuarioId, a) {
  const { rows } = await db.query(
    `INSERT INTO hc_alergias (paciente_id, sustancia, reaccion, severidad, registrado_por)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [pacienteId, a.sustancia, a.reaccion, a.severidad, usuarioId]
  );
  return rows[0];
}

async function insertarAntecedente(db, pacienteId, usuarioId, a) {
  const { rows } = await db.query(
    `INSERT INTO hc_antecedentes (paciente_id, tipo, descripcion, parentesco, registrado_por)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [pacienteId, a.tipo, a.descripcion, a.parentesco, usuarioId]
  );
  return rows[0];
}

async function insertarEvolucion(db, pacienteId, medicoId, e) {
  const { rows } = await db.query(
    `INSERT INTO hc_evoluciones (paciente_id, medico_id, motivo, diagnostico, texto)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [pacienteId, medicoId, e.motivo, e.diagnostico, e.texto]
  );
  return rows[0];
}

async function insertarEstudio(db, pacienteId, usuarioId, e) {
  const { rows } = await db.query(
    `INSERT INTO hc_estudios (paciente_id, tipo, nombre, realizado_el, resultado, enlace, registrado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [pacienteId, e.tipo, e.nombre, e.realizadoEl, e.resultado, e.enlace, usuarioId]
  );
  return rows[0];
}

// Busca el registro a rectificar y lo bloquea para que dos rectificaciones
// simultaneas del mismo registro no pasen las dos (el UNIQUE es la red de seguridad).
async function buscarRegistro(db, entidad, registroId) {
  const { rows } = await db.query(
    `SELECT id, paciente_id FROM ${TABLAS[entidad]} WHERE id = $1 FOR SHARE`,
    [registroId]
  );
  return rows[0] || null;
}

async function insertarRectificacion(db, usuarioId, r) {
  const { rows } = await db.query(
    `INSERT INTO hc_rectificaciones (entidad, registro_id, motivo, registrado_por)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [r.entidad, r.registroId, r.motivo, usuarioId]
  );
  return rows[0];
}

module.exports = {
  listarAlergias,
  listarAntecedentes,
  listarEvoluciones,
  listarEstudios,
  insertarAlergia,
  insertarAntecedente,
  insertarEvolucion,
  insertarEstudio,
  buscarRegistro,
  insertarRectificacion,
};
