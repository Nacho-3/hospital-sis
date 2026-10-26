// Cliente HTTP del modulo de Camas. Vite reenvia /api al backend (vite.config.js).
const BASE = '/api/camas';

async function pedir(ruta, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${ruta}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const datos = await res.json().catch(() => null);
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
  disponible: { etiqueta: 'Disponible', color: 'var(--c-disponible)' },
  reservada: { etiqueta: 'Reservada', color: 'var(--c-reservada)' },
  ocupada: { etiqueta: 'Ocupada', color: 'var(--c-ocupada)' },
  en_limpieza: { etiqueta: 'En limpieza', color: 'var(--c-limpieza)' },
  en_mantenimiento: { etiqueta: 'En mantenimiento', color: 'var(--c-mantenimiento)' },
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
export function escucharEnVivo(manejadores, onConexion = () => {}) {
  const fuente = new EventSource(`${BASE}/en-vivo`);
  fuente.onopen = () => onConexion(true);
  fuente.onerror = () => onConexion(false);
  for (const [evento, fn] of Object.entries(manejadores)) {
    fuente.addEventListener(evento, (e) => fn(JSON.parse(e.data)));
  }
  return () => fuente.close();
}
