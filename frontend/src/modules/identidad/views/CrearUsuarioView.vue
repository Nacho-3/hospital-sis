<template>
  <section class="usuario-nuevo">
    <h2>Crear usuario</h2>

    <p v-if="!puedeCrear" role="alert">No tenés permiso para crear usuarios.</p>

    <form v-else class="usuario-nuevo__form" @submit.prevent="crear">
      <label>
        Email
        <input v-model="email" type="email" autocomplete="off" required />
      </label>
      <label>
        Nombre
        <input v-model="nombre" type="text" maxlength="80" required />
      </label>
      <label>
        Apellido
        <input v-model="apellido" type="text" maxlength="80" required />
      </label>
      <label>
        Contraseña(mínimo 8 caracteres)
        <input v-model="password" type="password" minlength="8" maxlength="72" autocomplete="new-password" required />
      </label>

      <fieldset>
        <legend>Roles</legend>
        <p v-if="cargandoRoles">Cargando roles...</p>
        <label v-for="rol in roles" :key="rol.id" class="usuario-nuevo__rol">
          <input v-model="rolesSeleccionados" type="checkbox" :value="rol.id" />
          {{ rol.nombre }}
        </label>
      </fieldset>

      <p v-if="error" class="usuario-nuevo__error" role="alert">{{ error }}</p>
      <p v-if="exito" class="usuario-nuevo__exito" role="status">{{ exito }}</p>

      <button type="submit" :disabled="enviando">
        {{ enviando ? 'Creando...' : 'Crear usuario' }}
      </button>
    </form>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { identidadApi } from '../services/identidadApi.js';
import { haySesion, tienePermiso } from '../services/sesion.js';

const router = useRouter();

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

const puedeCrear = computed(() => tienePermiso('usuario:crear'));

function irAlLogin() {
  router.push({ path: '/login', query: { volver: '/identidad/usuarios/nuevo' } });
}

async function cargarRoles() {
  cargandoRoles.value = true;
  try {
    roles.value = await identidadApi.listarRoles();
  } catch (e) {
    if (e.status === 401) return irAlLogin();
    error.value = e.status ? e.message : 'No se pudo conectar con el servidor';
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
    if (e.status === 401) return irAlLogin();
    error.value = e.status ? e.message : 'No se pudo conectar con el servidor';
  } finally {
    enviando.value = false;
  }
}

onMounted(() => {
  if (!haySesion.value) return irAlLogin();
  if (puedeCrear.value) cargarRoles();
});
</script>

<style scoped>
.usuario-nuevo__form {
  margin-top: var(--espacio-md);
  display: flex;
  flex-direction: column;
  gap: var(--espacio-md);
}

.aviso--margen {
  margin-top: var(--espacio-md);
}

.usuario-nuevo__fieldset {
  border: 1px solid var(--color-borde);
  border-radius: var(--radio-sm);
  padding: var(--espacio-md);
}

.usuario-nuevo__legend {
  padding: 0 var(--espacio-xs);
  font-weight: 600;
  color: var(--color-texto);
}

.usuario-nuevo__roles-lista {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-sm);
  margin-top: var(--espacio-xs);
}

.usuario-nuevo__rol-item {
  display: flex;
  align-items: center;
  gap: var(--espacio-sm);
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--color-texto);
}
</style>