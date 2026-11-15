<script setup>
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { haySesion, nombreCompleto, tienePermiso, cerrarSesion } from '../services/sesion.js';

const router = useRouter();

const puedeAdministrar = computed(
  () => tienePermiso('usuario:ver') || tienePermiso('usuario:crear') || tienePermiso('rol:administrar')
);

function irAIdentidad() {
  router.push('/identidad');
}

function salir() {
  cerrarSesion();
  router.replace('/login');
}

onMounted(() => {
  if (!haySesion.value) router.replace('/login');
});
</script>

<template>
  <section v-if="haySesion" class="pagina">
    <div class="tarjeta pila">
      <h2>Inicio</h2>
      <p>Bienvenido/a, <strong>{{ nombreCompleto }}</strong></p>

      <button v-if="puedeAdministrar" type="button" class="btn btn--primario" @click="irAIdentidad">
        Usuarios y roles
      </button>
      <button type="button" class="btn" @click="salir">Cerrar sesión</button>
    </div>
  </section>
</template>