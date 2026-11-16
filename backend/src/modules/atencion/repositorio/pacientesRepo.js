async function buscar(db, texto) {
  // Se escapan % y _ para que el usuario no los use como comodines
  const patron = texto ? `%${texto.replace(/[\\%_]/g, '\\$&')}%` : null;
  const { rows } = await db.query(
    `SELECT id, nombre, apellido, documento AS dni
       FROM pacientes
      WHERE $1::text IS NULL
         OR nombre ILIKE $1
         OR apellido ILIKE $1
         OR (nombre || ' ' || apellido) ILIKE $1
         OR (apellido || ' ' || nombre) ILIKE $1
         OR documento ILIKE $1
      ORDER BY apellido, nombre
      LIMIT 20`, [patron]);
  return rows;
}
module.exports = { buscar };