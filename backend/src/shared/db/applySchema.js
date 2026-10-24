const fs = require('fs');
const path = require('path');

// Aplica los .sql de ./schema en orden alfabetico.
// Los archivos tienen que ser idempotentes (IF NOT EXISTS, ON CONFLICT DO NOTHING).
// No borran datos: un cambio de columnas en una tabla que ya existe no se aplica solo.
// En ese caso hay que recrear la base local y volver a levantar el backend.
async function applySchema() {
  const pool = require('./pool');
  const dir = path.join(__dirname, 'schema');
  const files = fs.readdirSync(dir).filter((name) => name.endsWith('.sql')).sort();
  const client = await pool.connect();

  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        console.log(`Esquema aplicado: ${file}`);
      } catch (err) {
        try {
          await client.query('ROLLBACK');
        } catch (_) {
          // La conexion puede haber quedado sin transaccion abierta.
        }
        throw new Error(`Fallo al aplicar ${file}: ${err.message}`, { cause: err });
      }
    }
  } finally {
    client.release();
  }
}

module.exports = applySchema;

if (require.main === module) {
  require('dotenv').config();
  applySchema()
    .then(async () => {
      const pool = require('./pool');
      await pool.end();
    })
    .catch((err) => {
      console.error('No se pudo aplicar el esquema de la base.');
      console.error(err);
      process.exit(1);
    });
}
