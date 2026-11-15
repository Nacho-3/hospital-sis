<template>
  <section v-if="haySesion" class="pagina">
    <div class="tarjeta pila" style="max-width: 600px;">
      <h2>Inicio</h2>
      <p>Bienvenido/a, <span style="font-weight: 600; color: var(--color-texto);">{{ nombreCompleto }}</span></p>

      <div style="display: flex; gap: var(--espacio-md); align-items: center; margin-top: var(--espacio-xs);">
        <router-link v-if="tienePermiso('usuario:crear')" to="/identidad/usuarios/nuevo" class="btn btn--primario" style="text-decoration: none; display: inline-block;">
          Crear usuario
        </router-link>

        <button type="button" class="btn" @click="salir">Cerrar sesión</button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { haySesion, nombreCompleto, tienePermiso, cerrarSesion } from '../services/sesion.js';

const router = useRouter();

function salir() {
  cerrarSesion();
  router.push('/login');
}

onMounted(() => {
  if (!haySesion.value) router.replace('/login');
});
</script>