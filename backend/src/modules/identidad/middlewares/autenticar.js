const { verificarToken } = require('../servicio/auth.servicio');
const { NoAutenticadoError } = require('../dominio/errores');

const prefijo = 'Bearer ';

function autenticar(req, res, next) {
  const cabecera = req.headers.authorization;

  if (!cabecera || !cabecera.startsWith(prefijo)) {
    throw new NoAutenticadoError();
  }

  const token = cabecera.slice(prefijo.length).trim();
  req.usuario = verificarToken(token);
  next();
}

module.exports = autenticar;