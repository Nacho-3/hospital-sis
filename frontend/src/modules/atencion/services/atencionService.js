import { pedir } from './api.js';


export const buscarPacientes = (texto) =>
  pedir(`/pacientes?buscar=${encodeURIComponent(texto)}`);

export const registrarSignosVitales = (datos) =>
  pedir('/signos-vitales', { metodo: 'POST', cuerpo: datos });
export const listarSignosVitales = (pacienteId) =>
  pedir(`/pacientes/${pacienteId}/signos-vitales`);

// El backend devuelve filas en snake_case acá; se traducen en un solo lugar.
export async function listarPendientes(pacienteId) {
  const hasta = new Date(Date.now() + 2 * 3600_000).toISOString();   // incluye vencidas y próximas 2 h
  const filas = await pedir(
    `/administraciones/pendientes?pacienteId=${pacienteId}&hasta=${encodeURIComponent(hasta)}`);
  return filas.map((f) => ({
    id: f.id,
    programadaPara: new Date(f.programada_para),
    dosis: f.dosis,
    insumo: f.insumo_nombre ?? `Insumo #${f.insumo_id}`,
    cantidad: f.cantidad,
    margenMinutos: f.margen_minutos,
  }));
}
export const confirmarAdministracion = (id) =>
  pedir(`/administraciones/${id}/confirmar`, { metodo: 'POST' });

// Medicamentos para recetar y el stock del piso donde esta internado el paciente.
export const listarMedicamentos = (pacienteId) =>
  pedir(`/pacientes/${pacienteId}/medicamentos`);
export const crearIndicacion = (datos) =>
  pedir('/indicaciones', { metodo: 'POST', cuerpo: datos });

export async function listarNotas(pacienteId) {
  const filas = await pedir(`/pacientes/${pacienteId}/notas`);
  return filas.map((n) => ({ id: n.id, texto: n.texto, automatica: n.automatica, creadoEn: n.creado_en }));
}
export const crearNota = (pacienteId, texto) =>
  pedir('/notas', { metodo: 'POST', cuerpo: { pacienteId, texto } });

export async function listarAvisos() {
  const filas = await pedir('/avisos');
  return filas.map((a) => ({
    id: a.id,
    tipo: a.tipo,
    paciente: `${a.paciente_apellido}, ${a.paciente_nombre}`,
    medico: a.medico_id ? `${a.medico_apellido}, ${a.medico_nombre}` : '',
  }));
}
export const cerrarAviso = (id) => pedir(`/avisos/${id}/cerrar`, { metodo: 'POST' });

export const listarProtocolos = (pacienteId) => pedir(`/pacientes/${pacienteId}/protocolos`);
export const realizarTarea = (tareaId) =>
  pedir(`/protocolo-tareas/${tareaId}/realizar`, { metodo: 'PATCH' });