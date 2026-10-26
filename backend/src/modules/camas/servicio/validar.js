const { DatosInvalidosError } = require('../dominio/errores');

function enteroPositivo(valor, campo) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) {
    throw new DatosInvalidosError(`${campo} tiene que ser un entero positivo.`);
  }
  return n;
}

function entero(valor, campo, { minimo = -Infinity } = {}) {
  const n = Number(valor);
  if (valor === null || valor === undefined || valor === '' || !Number.isInteger(n) || n < minimo) {
    const limite = Number.isFinite(minimo) ? ` mayor o igual a ${minimo}` : '';
    throw new DatosInvalidosError(`${campo} tiene que ser un entero${limite}.`);
  }
  return n;
}

function texto(valor, campo, { opcional = false, max = 160 } = {}) {
  if (valor === undefined || valor === null || String(valor).trim() === '') {
    if (opcional) return null;
    throw new DatosInvalidosError(`Falta ${campo}.`);
  }
  const t = String(valor).trim();
  if (t.length > max) throw new DatosInvalidosError(`${campo} admite hasta ${max} caracteres.`);
  return t;
}

function unoDe(valor, campo, opciones) {
  if (!opciones.includes(valor)) {
    throw new DatosInvalidosError(`${campo} tiene que ser uno de: ${opciones.join(', ')}.`);
  }
  return valor;
}

module.exports = { enteroPositivo, entero, texto, unoDe };
