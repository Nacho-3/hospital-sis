const { DatosInvalidosError } = require('./errores');

const maxInt = 2147483647;

function esIdValido(valor) {
  return Number.isInteger(valor) && valor > 0 && valor <= maxInt;
}

function validarId(valor) {
  const texto = String(valor);
  if (!/^[1-9]\d*$/.test(texto) || !esIdValido(Number(texto))) {
    throw new DatosInvalidosError('El identificador no es válido');
  }
  return Number(texto);
}

function textoObligatorio(valor, campo, largoMaximo) {
  if (typeof valor !== 'string' || !valor.trim()) {
    throw new DatosInvalidosError(`El campo ${campo} es obligatorio`);
  }
  const limpio = valor.trim();
  if (limpio.length > largoMaximo) {
    throw new DatosInvalidosError(`El campo ${campo} no puede superar los ${largoMaximo} caracteres`);
  }
  return limpio;
}

module.exports = { esIdValido, validarId, textoObligatorio };