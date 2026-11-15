<script setup>
import { ref, onMounted } from 'vue';
import { identidadApi, mensajeDeError } from '../services/identidadApi.js';

const email = ref('');
const nombre = ref('');
const apellido = ref('');
const password = ref('');
const rolesSeleccionados = ref([]);

const roles = ref([]);
const cargandoRoles = ref(false);
const enviando = ref(false);
const error = ref('');
const exito = ref('');

async function cargarRoles() {
  cargandoRoles.value = true;
  try {
    roles.value = await identidadApi.listarRoles();
  } catch (e) {
    error.value = mensajeDeError(e);
  } finally {
    cargandoRoles.value = false;
  }
}

function limpiarFormulario() {
  email.value = '';
  nombre.value = '';
  apellido.value = '';
  password.value = '';
  rolesSeleccionados.value = [];
}

async function crear() {
  error.value = '';
  exito.value = '';

  if (rolesSeleccionados.value.length === 0) {
    error.value = 'Elegí al menos un rol';
    return;
  }

  enviando.value = true;
  try {
    const respuesta = await identidadApi.crearUsuario({
      email: email.value,
      nombre: nombre.value,
      apellido: apellido.value,
      password: password.value,
      roles: rolesSeleccionados.value,
    });
    exito.value = `Usuario creado: ${respuesta.usuario.email}`;
    limpiarFormulario();
  } catch (e) {
    error.value = mensajeDeError(e);
  } finally {
    enviando.value = false;
  }
}

onMounted(cargarRoles);
</script>

<template>
  <div class="tarjeta">
    <form @submit.prevent="crear">
      <div class="campo">
        <label for="nu-email">Email</label>
        <input id="nu-email" v-model="email" type="email" autocomplete="off" required />
      </div>
      <div class="campo">
        <label for="nu-nombre">Nombre</label>
        <input id="nu-nombre" v-model="nombre" type="text" maxlength="80" required />
      </div>
      <div class="campo">
        <label for="nu-apellido">Apellido</label>
        <input id="nu-apellido" v-model="apellido" type="text" maxlength="80" required />
      </div>
      <div class="campo">
        <label for="nu-password">Contraseña temporal (mínimo 8 caracteres)</label>
        <input
          id="nu-password"
          v-model="password"
          type="password"
          minlength="8"
          maxlength="72"
          autocomplete="new-password"
          required
        />
      </div>

      <fieldset>
        <legend>Roles</legend>
        <p v-if="cargandoRoles" class="tenue">Cargando roles...</p>
        <label v-for="rol in roles" :key="rol.id">
          <input v-model="rolesSeleccionados" type="checkbox" :value="rol.id" />
          {{ rol.nombre }}
        </label>
      </fieldset>

      <p v-if="error" class="aviso" role="alert">{{ error }}</p>
      <p v-if="exito" class="aviso" role="status">{{ exito }}</p>

      <button type="submit" class="btn btn--primario" :disabled="enviando">
        {{ enviando ? 'Creando...' : 'Crear usuario' }}
      </button>
    </form>
  </div>
</template>