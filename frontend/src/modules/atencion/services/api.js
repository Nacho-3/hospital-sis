const BASE = '/api/atencion';

export class ErrorApi extends Error {
  constructor(mensaje, codigo, status) { super(mensaje); this.codigo = codigo; this.status = status; }
}

export async function pedir(ruta, { metodo = 'GET', cuerpo } = {}) {
  const res = await fetch(BASE + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' /* + Authorization del módulo identidad */ },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new ErrorApi(datos.mensaje ?? 'Error inesperado', datos.error, res.status);
  return datos;
}