const pool = require('../../../shared/db/pool');

// Corre fn(client) dentro de BEGIN/COMMIT con una conexion propia del pool.
// Si algo falla hace ROLLBACK y vuelve a lanzar el error.
async function conTransaccion(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      // La conexion puede haber quedado sin transaccion abierta.
    }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { conTransaccion };
