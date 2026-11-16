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

async function listar() {
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.nombre, u.apellido, u.activo, u.creado_en,
            COALESCE(
              array_agg(r.nombre::text ORDER BY r.nombre) FILTER (WHERE r.id IS NOT NULL),
              '{}'
            ) AS roles
     FROM usuarios u
     LEFT JOIN usuario_rol ur ON ur.usuario_id = u.id
     LEFT JOIN roles r        ON r.id = ur.rol_id
     GROUP BY u.id
     ORDER BY u.apellido, u.nombre`
  );
  return rows;
}

async function cambiarActivo(id, activo) {
  const { rows } = await pool.query(
    'UPDATE usuarios SET activo = $2 WHERE id = $1 RETURNING id, email, activo',
    [id, activo]
  );
  return rows[0];
}

async function obtenerSesion(usuarioId) {
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.activo,
            COALESCE(
              array_agg(DISTINCT p.codigo::text) FILTER (WHERE p.id IS NOT NULL),
              '{}'
            ) AS permisos
     FROM usuarios u
     LEFT JOIN usuario_rol ur ON ur.usuario_id = u.id
     LEFT JOIN rol_permiso rp ON rp.rol_id = ur.rol_id
     LEFT JOIN permisos p     ON p.id = rp.permiso_id
     WHERE u.id = $1
     GROUP BY u.id`,
    [usuarioId]
  );
  return rows[0];
}

module.exports = { buscarPorEmail, obtenerPermisos, crearConRoles, listar, cambiarActivo, obtenerSesion };