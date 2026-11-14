<template>
  <section class="login">
    <h2>Iniciar sesión</h2>
    <form class="login__form" @submit.prevent="ingresar">
      <label>
        Email
        <input v-model="email" type="email" autocomplete="username" required />
      </label>
      <label>
        Contraseña
        <input v-model="password" type="password" autocomplete="current-password" required />
      </label>
      <p v-if="error" class="login__error" role="alert">{{ error }}</p>
      <button type="submit" :disabled="cargando">
        {{ cargando ? 'Ingresando...' : 'Ingresar' }}
      </button>
    </form>
  </section>
</template>

<script setup>
  import { ref } from 'vue';
  import { useRouter, useRoute } from 'vue-router';
  import { identidadApi } from '../services/identidadApi.js';
  import { iniciarSesion } from '../services/sesion.js';
  
  const router = useRouter();
  const route = useRoute();
  
  const email = ref('');
  const password = ref('');
  const error = ref('');
  const cargando = ref(false);
  
  async function ingresar() {
    error.value = '';
    cargando.value = true;
    try {
      const datos = await identidadApi.login(email.value, password.value);
      iniciarSesion(datos);
      const destino = route.query.volver;
      router.push(typeof destino === 'string' && destino.startsWith('/') ? destino : '/');
    } catch (e) {
      error.value = e.status ? e.message : 'No se pudo conectar con el servidor';
    } finally {
      cargando.value = false;
    }
  }
</script>

<style scoped>
.login__pagina {
  max-width: 440px;
  margin-top: var(--espacio-xl);
}

.login__titulo {
  margin-bottom: var(--espacio-md);
}

.login__form {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-md);
}
</style>