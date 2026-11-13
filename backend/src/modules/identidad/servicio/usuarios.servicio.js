const bcrypt = require('bcryptjs');
const usuariosRepo = require('../repositorio/usuarios.repositorio');
const rolesRepo = require('../repositorio/roles.repositorio');
const { DatosInvalidosError } = require('../dominio/errores');

const largoMinPassword = 8;
const largoMaxPassword = 12;
const formatoEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

async function crear({ email, nombre, apellido, password, roles } = {}) {
  const emailLimpio = textoObligatorio(email, 'email', 160).toLowerCase();
  if (!formatoEmail.test(emailLimpio)) {
    throw new DatosInvalidosError('El email no tiene un formato válido');
  }
  const nombreLimpio = textoObligatorio(nombre, 'nombre', 80);
  const apellidoLimpio = textoObligatorio(apellido, 'apellido', 80);

  if (
    typeof password !== 'string' ||
    password.length < largoMinPassword ||
    password.length > largoMaxPassword
  ) {
    throw new DatosInvalidosError(
      `La contraseña debe tener entre ${largoMinPassword} y ${largoMaxPassword} caracteres`
    );
  }

  if (!Array.isArray(roles) || roles.length === 0 || !roles.every((r) => Number.isInteger(r) && r > 0)) {
    throw new DatosInvalidosError('Debe asignarse al menos un rol válido');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const rolesIds = [...new Set(roles)];

  return usuariosRepo.crearConRoles({
    email: emailLimpio,
    nombre: nombreLimpio,
    apellido: apellidoLimpio,
    passwordHash,
    rolesIds,
  });
}

function listarRoles() {
  return rolesRepo.listar();
}

module.exports = { crear, listarRoles };