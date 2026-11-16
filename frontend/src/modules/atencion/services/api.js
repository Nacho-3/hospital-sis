import { token, cerrarSesion } from '../../identidad/services/sesion.js';

const BASE = '/api/atencion';

export class ErrorApi extends Error {
  constructor(mensaje, codigo, status) { super(mensaje); this.codigo = codigo; this.status = status; }
}

export async function pedir(ruta, { metodo = 'GET', cuerpo } = {}) {
  const headers = {};
  if (cuerpo !== undefined) headers['Content-Type'] = 'application/json';
  if (token.value) headers.Authorization = `Bearer ${token.value}`;
  const res = await fetch(BASE + ruta, {
    method: metodo,
    headers,
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const datos = await res.json().catch(() => ({}));
  if (res.status === 401 && token.value) cerrarSesion();
  if (!res.ok) throw new ErrorApi(datos.mensaje ?? 'Error inesperado', datos.error, res.status);
  return datos;
}