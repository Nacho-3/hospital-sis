// Sesion del usuario para el modulo de Camas.
//
// La sesion la maneja Identidad (login, cierre de sesion y redireccion a
// /login). Camas solo lee el token y los permisos de ahi, para mandar el
// token en cada pedido y mostrar solo las acciones que el usuario puede
// hacer. Quien decide de verdad es el backend: esto evita mostrar botones
// que darian 403.
import { token, tienePermiso, cerrarSesion } from '../../identidad/services/sesion.js';

export { token, cerrarSesion };

export const puede = (permiso) => tienePermiso(permiso);

export const PERMISOS = {
  VER_MAPA: 'cama:ver_mapa',
  ASIGNAR: 'cama:asignar',
  CONFIRMAR_LIMPIEZA: 'cama:confirmar_limpieza',
  VER_INVENTARIO: 'inventario:ver',
  REPONER_INVENTARIO: 'inventario:reponer',
};
