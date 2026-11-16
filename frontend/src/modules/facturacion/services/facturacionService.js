// Cliente HTTP del modulo de Facturacion. Vite reenvia /api al backend (vite.config.js).
// Manda el token de la sesion de Identidad; si el backend responde 401
// (token vencido o usuario desactivado) se cierra la sesion y la app vuelve al login.
import { token, cerrarSesion } from '../../identidad/services/sesion.js';

const BASE = '/api/facturacion';

// Si el backend responde un error, lanza un Error con su mensaje, su codigo y el status.
async function pedir(ruta, { method = 'GET', body } = {}) {
  let res;
  try {
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (token.value) headers.Authorization = `Bearer ${token.value}`;
    res = await fetch(`${BASE}${ruta}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor.');
  }
  const datos = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token.value) cerrarSesion();
    // Sin mensaje del backend y con 5xx: tipico del proxy de Vite cuando el backend esta caido.
    const porDefecto = res.status >= 500 ? 'El servidor no responde. Revisá que el backend esté levantado.' : `Error ${res.status}`;
    const error = new Error(datos?.mensaje || porDefecto);
    error.codigo = datos?.error;
    error.status = res.status;
    throw error;
  }
  return datos;
}

const paciente = (pacienteId) => encodeURIComponent(pacienteId);

export const facturacionService = {
  coberturas: () => pedir('/coberturas'),
  nomenclador: () => pedir('/nomenclador'),
  preciosInsumo: () => pedir('/precios-insumo'),

  obtenerCobertura: (pacienteId) => pedir(`/cobertura/${paciente(pacienteId)}`),
  // coberturaId null = el paciente queda como particular.
  asignarCobertura: (pacienteId, coberturaId) =>
    pedir(`/cobertura/${paciente(pacienteId)}`, { method: 'PUT', body: { coberturaId } }),

  obtenerCuenta: (pacienteId) => pedir(`/cuenta/${paciente(pacienteId)}`),
  // Factura una prestacion del nomenclador por su valor base.
  facturarPrestacion: (pacienteId, nomencladorId) =>
    pedir(`/cuenta/${paciente(pacienteId)}/prestaciones`, { method: 'POST', body: { nomencladorId } }),
  // { concepto, monto }
  registrarCargo: (pacienteId, cargo) =>
    pedir(`/cuenta/${paciente(pacienteId)}/cargos`, { method: 'POST', body: cargo }),

  // Solo en desarrollo: publica MedicacionAdministrada como lo hara Atencion.
  // { pacienteId, insumoId, cantidad }
  simularMedicacion: (carga) =>
    pedir('/simulacion/medicacion-administrada', { method: 'POST', body: carga }),
};
