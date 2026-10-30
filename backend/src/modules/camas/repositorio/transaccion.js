const pool = require('../../../shared/db/pool');
const { ConcurrenciaError } = require('../../../shared/errors/DomainError');
const {
  PacienteYaInternadoError,
  NoEncontradoError,
  StockInsuficienteError,
} = require('../dominio/errores');

// Corre fn(client) dentro de BEGIN/COMMIT con una conexion propia del pool.
// Si algo falla hace ROLLBACK y traduce los errores de PostgreSQL que son
// reglas de negocio (indices unicos, claves foraneas, CHECK de stock).
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
    throw traducirErrorPg(err);
  } finally {
    client.release();
  }
}

function traducirErrorPg(err) {
  switch (err.code) {
    // unique_violation: la red de seguridad de los indices parciales.
    case '23505':
      if (err.constraint === 'asignaciones_cama_vigente_uidx') {
        return new ConcurrenciaError('La cama acaba de ser ocupada por otro paciente.');
      }
      if (err.constraint === 'asignaciones_paciente_vigente_uidx') {
        return new PacienteYaInternadoError(extraerId(err.detail));
      }
      if (err.constraint === 'camas_reserva_paciente_uidx') {
        return new ConcurrenciaError('El paciente ya tiene otra cama reservada.');
      }
      return err;
    // foreign_key_violation
    case '23503':
      if (/pacientes/.test(err.detail || '')) {
        return new NoEncontradoError('el paciente', extraerId(err.detail));
      }
      return err;
    // check_violation: el stock no puede quedar negativo.
    case '23514':
      if (/stock/.test(err.constraint || '')) {
        return new StockInsuficienteError();
      }
      return err;
    default:
      return err;
  }
}

function extraerId(detail) {
  const m = /=\((\d+)\)/.exec(detail || '');
  return m ? m[1] : '?';
}

module.exports = { conTransaccion, traducirErrorPg };
