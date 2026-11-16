const pool = require('./pool');

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
      // Preserve the original transaction error.
    }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { conTransaccion };
