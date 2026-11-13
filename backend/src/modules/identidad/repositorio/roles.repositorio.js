const pool = require('../../../shared/db/pool');

async function listar() {
  const { rows } = await pool.query(
    'SELECT id, codigo, nombre FROM roles ORDER BY nombre'
  );
  return rows;
}

module.exports = { listar };