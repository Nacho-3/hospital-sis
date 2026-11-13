const pool = require('../../../shared/db/pool');
const { UsuarioExistenteError, RolInexistenteError } = require('../dominio/errores');

async function buscarPorEmail(email) {
  const { rows } = await pool.query(
    `SELECT id, email, nombre, apellido, password_hash, activo
     FROM usuarios
     WHERE email = $1`,
    [email]
  );
  return rows[0];
}

async function obtenerPermisos(usuarioId) {
  const { rows } = await pool.query(
    `SELECT DISTINCT p.codigo
     FROM usuario_rol ur
     JOIN rol_permiso rp ON rp.rol_id = ur.rol_id
     JOIN permisos p     ON p.id = rp.permiso_id
     WHERE ur.usuario_id = $1
     ORDER BY p.codigo`,
    [usuarioId]
  );
  return rows.map((fila) => fila.codigo);
}

async function crearConRoles({ email, nombre, apellido, passwordHash, rolesIds }) {
  try {
    const { rows } = await pool.query(
      `WITH nuevo AS (
         INSERT INTO usuarios (email, nombre, apellido, password_hash)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email
       ),
       asignacion AS (
         INSERT INTO usuario_rol (usuario_id, rol_id)
         SELECT nuevo.id, t.rol_id
         FROM nuevo, unnest($5::int[]) AS t(rol_id)
       )
       SELECT id, email FROM nuevo`,
      [email, nombre, apellido, passwordHash, rolesIds]
    );
    return rows[0];
  } catch (err) {
    if (err.code === '23505') throw new UsuarioExistenteError();
    if (err.code === '23503') throw new RolInexistenteError();
    throw err;
  }
}

module.exports = { buscarPorEmail, obtenerPermisos, crearConRoles };