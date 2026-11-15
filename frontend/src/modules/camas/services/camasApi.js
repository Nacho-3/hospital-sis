// Cliente HTTP del modulo de Camas. Vite reenvia /api al backend (vite.config.js).
// Cada pedido lleva el token de Identidad en el header Authorization.
import { token, cerrarSesion } from './sesion';

const BASE = '/api/camas';

async function pedir(ruta, { method = 'GET', body } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token.value) headers.Authorization = `Bearer ${token.value}`;

  const res = await fetch(`${BASE}${ruta}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const datos = await res.json().catch(() => null);
  // Token vencido o invalido: se cierra la sesion y la app vuelve a /login.
  if (res.status === 401 && token.value) cerrarSesion();
  if (!res.ok) {
    const error = new Error(datos?.mensaje || `Error ${res.status}`);
    error.codigo = datos?.error;
    error.status = res.status;
    throw error;
  }
  return datos;
}

const post = (ruta, body) => pedir(ruta, { method: 'POST', body: body || {} });

export const ESTADOS = {
  disponible: { etiqueta: 'Disponible', color: 'var(--estado-disponible)' },
  reservada: { etiqueta: 'Reservada', color: 'var(--estado-reservada)' },
  ocupada: { etiqueta: 'Ocupada', color: 'var(--estado-ocupada)' },
  en_limpieza: { etiqueta: 'En limpieza', color: 'var(--estado-limpieza)' },
  en_mantenimiento: { etiqueta: 'En mantenimiento', color: 'var(--estado-mantenimiento)' },
};

export const TIPOS_HABITACION = {
  individual: 'Individual',
  compartida: 'Compartida',
  uti: 'UTI',
  guardia: 'Guardia',
};

export const camasApi = {
  mapa: () => pedir('/'),
  detalle: (id) => pedir(`/${id}`),
  historial: (id) => pedir(`/${id}/historial`),
  pacientesSinCama: () => pedir('/pacientes-sin-cama'),

  asignar: (id, pacienteId, motivo) => post(`/${id}/asignar`, { pacienteId, motivo }),
  reservar: (id, pacienteId) => post(`/${id}/reservar`, { pacienteId }),
  cancelarReserva: (id) => post(`/${id}/cancelar-reserva`),
  liberar: (id, motivoEgreso = 'alta') => post(`/${id}/liberar`, { motivoEgreso }),
  finalizarLimpieza: (id) => post(`/${id}/finalizar-limpieza`),
  enviarAMantenimiento: (id) => post(`/${id}/mantenimiento`),
  finalizarMantenimiento: (id) => post(`/${id}/finalizar-mantenimiento`),
  trasladar: (pacienteId, camaDestinoId) => post(`/pacientes/${pacienteId}/trasladar`, { camaDestinoId }),

  inventario: (filtros = {}) => pedir(`/inventario?${new URLSearchParams(filtros)}`),
  movimientos: (id) => pedir(`/inventario/${id}/movimientos`),
  insumos: () => pedir('/inventario/insumos'),
  reponer: (id, cantidad) => post(`/inventario/${id}/reponer`, { cantidad }),
  configurarInventario: (datos) => post('/inventario', datos),
};

// Canal en vivo (Server-Sent Events). EventSource reconecta solo si se corta.
// onConexion(true|false) avisa cuando se conecta o se cae.
// Devuelve una funcion para cerrarlo.
// EventSource no puede mandar headers: el token va en la URL.
export function escucharEnVivo(manejadores, onConexion = () => {}) {
  const fuente = new EventSource(`${BASE}/en-vivo?token=${encodeURIComponent(token.value || '')}`);
  fuente.onopen = () => onConexion(true);
  fuente.onerror = () => onConexion(false);
  for (const [evento, fn] of Object.entries(manejadores)) {
    fuente.addEventListener(evento, (e) => fn(JSON.parse(e.data)));
  }
  return () => fuente.close();
}
