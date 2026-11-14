import { reactive } from 'vue';

export const avisos = reactive([]);
let siguiente = 1;

export function avisar(mensaje, tipo = 'exito', ms = 4000) {   // tipo: 'exito' | 'error' | 'alerta'
  const aviso = { id: siguiente++, mensaje, tipo };
  avisos.push(aviso);
  setTimeout(() => {
    const i = avisos.findIndex((a) => a.id === aviso.id);
    if (i >= 0) avisos.splice(i, 1);
  }, ms);
}