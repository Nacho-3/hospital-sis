import { ref, computed } from 'vue';

const CLAVE = 'his.sesion';

function leerGuardada() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE)) || {};
  } catch {
    return {};
  }
}

const guardada = leerGuardada();

export const token = ref(guardada.token || null);
export const usuario = ref(guardada.usuario || null);

export const haySesion = computed(() => token.value !== null);
export const nombreCompleto = computed(() =>
  usuario.value ? `${usuario.value.nombre} ${usuario.value.apellido}` : ''
);

export function iniciarSesion(datos) {
  token.value = datos.token;
  usuario.value = datos.usuario;
  localStorage.setItem(CLAVE, JSON.stringify({ token: datos.token, usuario: datos.usuario }));
}

export function cerrarSesion() {
  token.value = null;
  usuario.value = null;
  localStorage.removeItem(CLAVE);
}

export function tienePermiso(codigo) {
  return usuario.value?.permisos?.includes(codigo) ?? false;
}