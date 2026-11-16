const pool = require('../../../shared/db/pool');

async function listar() {
  const { rows } = await pool.query(
    'SELECT id, codigo, descripcion FROM permisos ORDER BY codigo'
  );
  return rows;
}

module.exports = { listar };