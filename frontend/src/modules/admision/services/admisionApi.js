// Cliente HTTP de Admision. Vite reenvia /api al backend.
const BASE = '/api/admision';

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

const post = (ruta, body) => pedir(ruta, { method: 'POST', body });

export const admisionApi = {
  pacientes: () => pedir('/pacientes'),
  registrarPaciente: (datos) => post('/pacientes', datos),
  medicos: () => pedir('/medicos'),
  turnos: () => pedir('/turnos'),
  abrirTurno: (datos) => post('/turnos', datos),
  reservar: (turnoId, pacienteId) => post(`/turnos/${turnoId}/reservar`, { pacienteId }),
  insertarEntreturno: (turnoId) => post(`/turnos/${turnoId}/entreturno`),
};
