// Cliente HTTP de la Historia Clinica. Vite reenvia /api al backend.
// La sesion es la de Identidad: se manda su token y, ante un 401, se cierra
// la sesion y la app vuelve al login.
import { token, cerrarSesion, tienePermiso } from '../../identidad/services/sesion.js';

const BASE = '/api/historia';

async function pedir(ruta, { method = 'GET', body } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token.value) headers.Authorization = `Bearer ${token.value}`;
  const res = await fetch(`${BASE}${ruta}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
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

const post = (ruta, body) => pedir(ruta, { method: 'POST', body });

export const historiaApi = {
  buscar: (texto) => pedir(`/pacientes?buscar=${encodeURIComponent(texto)}`),
  resumen: (id) => pedir(`/pacientes/${id}`),
  lineaDeTiempo: (id) => pedir(`/pacientes/${id}/linea-de-tiempo`),
  listar: (id, entidad) => pedir(`/pacientes/${id}/${RUTA[entidad]}`),
  registrar: (id, entidad, datos) => post(`/pacientes/${id}/${RUTA[entidad]}`, datos),
  rectificar: (id, entidad, registroId, motivo) =>
    post(`/pacientes/${id}/rectificaciones`, { entidad, registroId, motivo }),
};

const RUTA = {
  alergia: 'alergias',
  antecedente: 'antecedentes',
  evolucion: 'evoluciones',
  estudio: 'estudios',
};

export const PERMISOS = {
  VER: 'historia:ver',
  REGISTRAR: 'historia:registrar',
  EVOLUCIONAR: 'historia:evolucionar',
  RECTIFICAR: 'historia:rectificar',
};

export const puede = (permiso) => tienePermiso(permiso);

export const fecha = (v, conHora = true) =>
  v
    ? new Date(v).toLocaleString('es-AR', conHora ? { dateStyle: 'short', timeStyle: 'short' } : { dateStyle: 'short', timeZone: 'UTC' })
    : '';

export const nombre = (r, prefijo = 'autor') =>
  r[`${prefijo}_apellido`] ? `${r[`${prefijo}_nombre`]} ${r[`${prefijo}_apellido`]}` : '';
