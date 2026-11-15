const authServicio = require('../servicio/auth.servicio');
const { NoAutenticadoError } = require('../dominio/errores');

const PREFIJO = 'Bearer ';

async function autenticar(req, res, next) {
  let usuario;
  try {
    const cabecera = req.headers.authorization;
    if (!cabecera || !cabecera.startsWith(PREFIJO)) {
      throw new NoAutenticadoError();
    }
    const token = cabecera.slice(PREFIJO.length).trim();
    usuario = await authServicio.resolverSesion(token);
  } catch (err) {
    return next(err);
  }

  req.usuario = usuario;
  next();
}

module.exports = autenticar;