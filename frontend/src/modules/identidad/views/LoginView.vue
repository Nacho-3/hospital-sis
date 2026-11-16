<template>
  <section class="pagina" style="max-width: 440px; margin-top: var(--espacio-xl);">
    <div class="tarjeta">
      <h2 style="margin-bottom: var(--espacio-md);">Iniciar sesión</h2>
      <form class="pila" @submit.prevent="ingresar">
        <div class="campo">
          <label for="login-email">Email</label>
          <input id="login-email" v-model="email" type="email" autocomplete="username" required />
        </div>

        <div class="campo">
          <label for="login-password">Contraseña</label>
          <input id="login-password" v-model="password" type="password" autocomplete="current-password" required />
        </div>

        <p v-if="error" class="aviso aviso--error" role="alert">{{ error }}</p>

        <div>
          <button type="submit" class="btn btn--primario" :disabled="cargando">
            {{ cargando ? 'Ingresando...' : 'Ingresar' }}
          </button>
        </div>
      </form>
    </div>
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