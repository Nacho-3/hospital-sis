const { DatosInvalidosError } = require('../dominio/errores');

// Validacion de lo que entra por la API o por un evento. Lo que no cumple
// corta con DatosInvalidosError (400) antes de llegar a la base.

// NUMERIC(12, 2) de la base: hasta 9.999.999.999,99.
const MONTO_MAXIMO = 9_999_999_999.99;

// Acepta el numero o su texto en digitos ("12"), que es como llega un parametro de la URL.
function enteroPositivo(valor, campo) {
  const n = typeof valor === 'string' && /^\d+$/.test(valor) ? Number(valor) : valor;
  if (!Number.isSafeInteger(n) || n <= 0) {
    throw new DatosInvalidosError(`${campo} tiene que ser un entero positivo.`);
  }
  return n;
}

function texto(valor, campo, { max = 160 } = {}) {
  if (valor === undefined || valor === null || String(valor).trim() === '') {
    throw new DatosInvalidosError(`Falta ${campo}.`);
  }
  const t = String(valor).trim();
  if (t.length > max) throw new DatosInvalidosError(`${campo} admite hasta ${max} caracteres.`);
  return t;
}

// Monto en pesos: numero mayor a cero y con centavos como maximo.
function monto(valor, campo) {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0) {
    throw new DatosInvalidosError(`${campo} tiene que ser un numero mayor a cero.`);
  }
  if (valor > MONTO_MAXIMO) {
    throw new DatosInvalidosError(`${campo} supera el maximo permitido.`);
  }
  if (Math.abs(valor * 100 - Math.round(valor * 100)) > 1e-6) {
    throw new DatosInvalidosError(`${campo} admite hasta dos decimales.`);
  }
  return valor;
}

module.exports = { enteroPositivo, texto, monto };
