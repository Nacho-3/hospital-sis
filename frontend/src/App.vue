<script setup>
import { watch } from 'vue';
import { useRouter } from 'vue-router';
import { haySesion, nombreCompleto, cerrarSesion } from './modules/identidad/services/sesion.js';

const router = useRouter();

watch(haySesion, (hay) => {
  const actual = router.currentRoute.value;
  if (!hay && actual.path !== '/login') {
    router.replace({ path: '/login', query: { volver: actual.fullPath } });
  }
});
</script>

<template>
  <header v-if="haySesion" class="barra">
    <h1 class="barra__marca">Chotita</h1>
    <nav class="barra__nav">
      <router-link to="/" class="barra__link" active-class="" exact-active-class="barra__link--activo">Inicio</router-link>
      <router-link to="/admision" class="barra__link" active-class="barra__link--activo">Admisión</router-link>
      <router-link to="/atencion" class="barra__link" active-class="barra__link--activo">Atención</router-link>
      <router-link to="/camas" class="barra__link" active-class="barra__link--activo">Camas</router-link>
      <router-link to="/facturacion" class="barra__link" active-class="barra__link--activo">Facturación</router-link>

      <span class="tenue">{{ nombreCompleto }}</span>
      <button type="button" class="btn" @click="cerrarSesion">Cerrar sesión</button>
    </nav>
  </header>
  <main class="contenido">
    <router-view />
  </main>
</template>
