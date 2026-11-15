import { token, cerrarSesion } from './sesion.js';

// Cliente HTTP del modulo de Identidad. Vite reenvia /api al backend (vite.config.js).
const BASE = '/api/identidad';

async function pedir(ruta, { method = 'GET', body } = {}) {
  const cabeceras = {};
  if (body) cabeceras['Content-Type'] = 'application/json';
  if (token.value) cabeceras.Authorization = `Bearer ${token.value}`;

  const res = await fetch(`${BASE}${ruta}`, {
    method,
    headers: cabeceras,
    body: body ? JSON.stringify(body) : undefined,
  });
  const datos = await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 401 && token.value) cerrarSesion();
    const error = new Error(datos?.mensaje || `Error ${res.status}`);
    error.codigo = datos?.error;
    error.status = res.status;
    throw error;
  }
  return datos;
}

export const identidadApi = {
  login: (email, password) => pedir('/auth/login', { method: 'POST', body: { email, password } }),
  listarRoles: () => pedir('/roles'),
  crearUsuario: (datos) => pedir('/usuarios', { method: 'POST', body: datos }),

  listarUsuarios: () => pedir('/usuarios'),
  desactivarUsuario: (id) => pedir(`/usuarios/${id}/desactivar`, { method: 'POST' }),
  reactivarUsuario: (id) => pedir(`/usuarios/${id}/reactivar`, { method: 'POST' }),

  listarPermisos: () => pedir('/permisos'),
  crearRol: (datos) => pedir('/roles', { method: 'POST', body: datos }),
  permisosDeRol: (id) => pedir(`/roles/${id}/permisos`),
  guardarPermisosDeRol: (id, permisos) =>
    pedir(`/roles/${id}/permisos`, { method: 'PUT', body: { permisos } }),
};