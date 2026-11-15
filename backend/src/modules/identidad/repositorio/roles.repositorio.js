const pool = require('../../../shared/db/pool');
const { RolExistenteError, PermisoInexistenteError } = require('../dominio/errores');

async function listar() {
  const { rows } = await pool.query('SELECT id, codigo, nombre FROM roles ORDER BY nombre');
  return rows;
}

async function buscarPorId(id) {
  const { rows } = await pool.query('SELECT id, codigo, nombre FROM roles WHERE id = $1', [id]);
  return rows[0];
}

async function crear({ codigo, nombre }) {
  try {
    const { rows } = await pool.query(
      'INSERT INTO roles (codigo, nombre) VALUES ($1, $2) RETURNING id, codigo, nombre',
      [codigo, nombre]
    );
    return rows[0];
  } catch (err) {
    if (err.code === '23505') throw new RolExistenteError();
    throw err;
  }
}

async function permisosDeRol(rolId) {
  const { rows } = await pool.query(
    'SELECT permiso_id FROM rol_permiso WHERE rol_id = $1 ORDER BY permiso_id',
    [rolId]
  );
  return rows.map((fila) => fila.permiso_id);
}

async function reemplazarPermisos(rolId, permisosIds) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM rol_permiso WHERE rol_id = $1', [rolId]);
    await client.query(
      `INSERT INTO rol_permiso (rol_id, permiso_id)
       SELECT $1::int, unnest($2::int[])`,
      [rolId, permisosIds]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23503') throw new PermisoInexistenteError();
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { listar, buscarPorId, crear, permisosDeRol, reemplazarPermisos };