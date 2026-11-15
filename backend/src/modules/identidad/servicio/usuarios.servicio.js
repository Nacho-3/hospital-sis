const bcrypt = require('bcryptjs');
const usuariosRepo = require('../repositorio/usuarios.repositorio');
const rolesRepo = require('../repositorio/roles.repositorio');
const {
  DatosInvalidosError,
  OperacionNoPermitidaError,
  UsuarioInexistenteError,
} = require('../dominio/errores');
const { textoObligatorio, validarId } = require('../dominio/validaciones');

const largoMinPassword = 8;
const largoMaxPassword = 12;
const formatoEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function listar() {
  return usuariosRepo.listar();
}

async function cambiarActivo(id, activo) {
  const usuario = await usuariosRepo.cambiarActivo(id, activo);
  if (!usuario) throw new UsuarioInexistenteError();
  return usuario;
}

async function desactivar(id, usuarioActualId) {
  const idUsuario = validarId(id);
  if (idUsuario === usuarioActualId) {
    throw new OperacionNoPermitidaError('No podés desactivar tu propio usuario');
  }
  return cambiarActivo(idUsuario, false);
}

async function reactivar(id) {
  return cambiarActivo(validarId(id), true);
}

module.exports = { crear, listar, desactivar, reactivar };