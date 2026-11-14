const pool = require('../../../shared/db/pool');
const { DomainError } = require('../../../shared/errors/DomainError');
const {
  NoEncontradoError,
  DatosInvalidosError,
  HorarioSuperpuestoError,
} = require('../dominio/errores');

// Una conexion propia del pool, con BEGIN y COMMIT.
// Si fn lanza, se hace ROLLBACK: el turno no queda a medias.
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
  if (err instanceof DomainError) return err;
  switch (err.code) {
    case '23505':
      if (err.constraint === 'pacientes_documento_key') {
        return new DatosInvalidosError('Ya hay un paciente con ese documento.');
      }
      return err;
    case '23503':
      if (/usuarios/.test(err.detail || '') || /medico/.test(err.constraint || '')) {
        return new NoEncontradoError('el médico', extraerId(err.detail));
      }
      if (/pacientes/.test(err.detail || '')) {
        return new NoEncontradoError('el paciente', extraerId(err.detail));
      }
      return err;
    // exclusion_violation: turnos_sin_solape.
    case '23P01':
      return new HorarioSuperpuestoError();
    default:
      return err;
  }
}

function extraerId(detail) {
  const m = /=\((\d+)\)/.exec(detail || '');
  return m ? m[1] : '?';
}

module.exports = { conTransaccion };
