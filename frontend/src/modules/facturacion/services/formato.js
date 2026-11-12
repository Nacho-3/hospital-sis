// Como se muestran los datos de Facturacion. Las clases son las de shared/estilos.css.

export const DESTINATARIOS = {
  paciente: { etiqueta: 'Paciente', clase: 'badge--alerta' },
  obra_social: { etiqueta: 'Obra social', clase: 'badge--exito' },
  estado: { etiqueta: 'Estado', clase: 'badge--exito' },
};

export const TIPOS_COBERTURA = {
  prepaga: { etiqueta: 'Prepaga', clase: 'badge--exito' },
  publica: { etiqueta: 'Pública', clase: 'badge--exito' },
  particular: { etiqueta: 'Particular', clase: 'badge--alerta' },
};

const PESOS = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
const FECHA_HORA = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatearMonto(valor) {
  return PESOS.format(valor ?? 0);
}

export function formatearFecha(fechaIso) {
  return fechaIso ? FECHA_HORA.format(new Date(fechaIso)) : '-';
}
