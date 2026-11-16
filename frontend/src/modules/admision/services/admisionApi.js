// Cliente HTTP de Admision. Vite reenvia /api al backend.
// Manda el token de la sesion de Identidad; si el backend responde 401
// (token vencido o usuario desactivado) se cierra la sesion y la app vuelve al login.
import { token, cerrarSesion } from '../../identidad/services/sesion.js';

const BASE = '/api/admision';

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

export const admisionApi = {
  pacientes: () => pedir('/pacientes'),
  registrarPaciente: (datos) => post('/pacientes', datos),
  medicos: () => pedir('/medicos'),
  turnos: () => pedir('/turnos'),
  abrirTurno: (datos) => post('/turnos', datos),
  reservar: (turnoId, pacienteId) => post(`/turnos/${turnoId}/reservar`, { pacienteId }),
  insertarEntreturno: (turnoId) => post(`/turnos/${turnoId}/entreturno`),
  listaEspera: () => pedir('/lista-espera'),
  anotarEnEspera: (datos) => post('/lista-espera', datos),
  cancelar: (turnoId) => post(`/turnos/${turnoId}/cancelar`),
  confirmar: (turnoId) => post(`/turnos/${turnoId}/confirmar`),
  registrarLlegada: (turnoId) => post(`/turnos/${turnoId}/llegada`),
  atender: (turnoId) => post(`/turnos/${turnoId}/atender`),
  enfermeros: () => pedir('/enfermeros'),
  guardia: () => pedir('/guardia'),
  clasificarGuardia: (datos) => post('/guardia', datos),
  ingresarObservacion: (datos) => post('/observacion', datos),
};
