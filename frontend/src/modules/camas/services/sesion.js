import { reactive } from 'vue';

// Sesion del usuario para el modulo de Camas.
//
// El token lo emite Identidad (POST /api/identidad/auth/login) y se guarda en
// localStorage con la clave 'token'. Cuando Identidad tenga su pantalla de
// login, tiene que guardarlo con esa misma clave (o se cambia CLAVE aca).
// Los permisos vienen adentro del token (JWT), asi que se leen de ahi para
// mostrar solo las acciones que el usuario puede hacer. Quien decide de
// verdad es el backend: esto es solo para no mostrar botones que darian 403.
const CLAVE = 'token';

function leer() {
  try {
    return localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}

function decodificar(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join('')
    );
    const datos = JSON.parse(json);
    // Token vencido: se trata como si no hubiera sesion.
    if (datos.exp && datos.exp * 1000 < Date.now()) return null;
    return datos;
  } catch {
    return null;
  }
}

export const sesion = reactive({ token: null, usuario: null });

function cargar(token) {
  const datos = token ? decodificar(token) : null;
  sesion.token = datos ? token : null;
  sesion.usuario = datos ? { id: datos.id, email: datos.email, permisos: datos.permisos || [] } : null;
}

cargar(leer());

export function guardarToken(token) {
  try {
    localStorage.setItem(CLAVE, token);
  } catch {
    // Sin localStorage la sesion dura hasta recargar la pagina.
  }
  cargar(token);
}

export function cerrarSesion() {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // Nada que borrar.
  }
  cargar(null);
}

export const puede = (permiso) => Boolean(sesion.usuario?.permisos.includes(permiso));

export const PERMISOS = {
  VER_MAPA: 'cama:ver_mapa',
  ASIGNAR: 'cama:asignar',
  CONFIRMAR_LIMPIEZA: 'cama:confirmar_limpieza',
  VER_INVENTARIO: 'inventario:ver',
  REPONER_INVENTARIO: 'inventario:reponer',
};

// Login provisorio mientras Identidad no tenga pantalla propia.
export async function iniciarSesion(email, password) {
  const res = await fetch('/api/identidad/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const datos = await res.json().catch(() => null);
  if (!res.ok) throw new Error(datos?.mensaje || `Error ${res.status}`);
  guardarToken(datos.token);
  return datos.usuario;
}
