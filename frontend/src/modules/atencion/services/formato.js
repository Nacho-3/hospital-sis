export const fechaHora = (v) =>
  new Date(v).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });