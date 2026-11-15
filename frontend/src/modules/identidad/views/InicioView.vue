<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { haySesion, nombreCompleto, tienePermiso } from '../services/sesion.js';

const router = useRouter();

const puedeAdministrar = computed(
  () => tienePermiso('usuario:ver') || tienePermiso('usuario:crear') || tienePermiso('rol:administrar')
);

function irAIdentidad() {
  router.push('/identidad');
}
</script>

<template>
  <section v-if="haySesion" class="pagina">
    <div class="tarjeta pila">
      <h2>Inicio</h2>
      <p>Bienvenido/a, <strong>{{ nombreCompleto }}</strong></p>

      <button v-if="puedeAdministrar" type="button" class="btn btn--primario" @click="irAIdentidad">
        Usuarios y roles
      </button>
    </div>
  </section>
</template>