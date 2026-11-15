const { autenticar, requierePermiso } = require('../../identidad');

// Codigos de permiso del modulo, segun la matriz de permisos.
// Los roles que tiene cada uno estan en 10-identidad.sql.
const PERMISOS = {
  VER_MAPA: 'cama:ver_mapa',               // Administrativo de piso, Personal de limpieza
  ASIGNAR: 'cama:asignar',                 // Administrativo de piso
  CONFIRMAR_LIMPIEZA: 'cama:confirmar_limpieza', // Personal de limpieza
  VER_INVENTARIO: 'inventario:ver',        // Gestor de inventario
  REPONER_INVENTARIO: 'inventario:reponer', // Gestor de inventario
};

// autenticar + requierePermiso juntos, para no repetirlos en cada ruta.
const con = (permiso) => [autenticar, requierePermiso(permiso)];

// El canal en vivo (Server-Sent Events) lo abre el navegador con EventSource,
// que no puede mandar el header Authorization. Para esa ruta el front manda
// el token como ?token=... y aca lo pasamos al header antes de autenticar.
function tokenDesdeQuery(req, res, next) {
  if (!req.headers.authorization && typeof req.query.token === 'string' && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
}

const tiene = (req, permiso) => Boolean(req.usuario?.permisos?.includes(permiso));

module.exports = { PERMISOS, con, tokenDesdeQuery, tiene, autenticar };
