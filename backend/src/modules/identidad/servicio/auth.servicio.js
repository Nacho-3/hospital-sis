const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const usuariosRepo = require('../repositorio/usuarios.repositorio');
const {
  CredencialesInvalidasError,
  DatosInvalidosError,
  NoAutenticadoError,
} = require('../dominio/errores');

const duracionToken = '8h';

async function login({ email, password } = {}) {
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    throw new DatosInvalidosError('El email y la contraseña son obligatorios');
  }

  const emailNormalizado = email.trim().toLowerCase();
  const usuario = await usuariosRepo.buscarPorEmail(emailNormalizado);

  if (!usuario || !usuario.activo) {
    throw new CredencialesInvalidasError();
  }

  const coincide = await bcrypt.compare(password, usuario.password_hash);
  if (!coincide) {
    throw new CredencialesInvalidasError();
  }

  const permisos = await usuariosRepo.obtenerPermisos(usuario.id);

  const token = jwt.sign(
    { id: usuario.id, email: usuario.email, permisos },
    process.env.JWT_SECRET,
    { expiresIn: duracionToken }
  );

  return {
    token,
    usuario: {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      permisos,
    },
  };
}

function verificarToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new NoAutenticadoError();
  }
}

module.exports = { login, verificarToken };