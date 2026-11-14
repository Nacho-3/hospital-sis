const { NoAutenticadoError, PermisoDenegadoError } = require('../dominio/errores');

function requierePermiso(permisoNecesario) {
  if (typeof permisoNecesario !== 'string' || !permisoNecesario) {
    throw new Error('requierePermiso necesita el código de un permiso');
  }

  return (req, res, next) => {
    if (!req.usuario) {
      throw new NoAutenticadoError();
    }
    if (!req.usuario.permisos?.includes(permisoNecesario)) {
      throw new PermisoDenegadoError();
    }
    next();
  };
}

module.exports = requierePermiso;