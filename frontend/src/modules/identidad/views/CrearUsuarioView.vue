<template>
  <section class="pagina pila">
    <h2>Crear usuario</h2>

    <p v-if="!puedeCrear" class="aviso aviso--error" role="alert">No tenés permiso para crear usuarios.</p>

    <div v-else class="tarjeta">
      <form class="pila" @submit.prevent="crear">
        <div class="campo">
          <label for="nuevo-email">Email</label>
          <input id="nuevo-email" v-model="email" type="email" autocomplete="off" required />
        </div>

        <div class="campo">
          <label for="nuevo-nombre">Nombre</label>
          <input id="nuevo-nombre" v-model="nombre" type="text" maxlength="80" required />
        </div>

        <div class="campo">
          <label for="nuevo-apellido">Apellido</label>
          <input id="nuevo-apellido" v-model="apellido" type="text" maxlength="80" required />
        </div>

        <div class="campo">
          <label for="nuevo-password">Contraseña (mínimo 8 caracteres)</label>
          <input id="nuevo-password" v-model="password" type="password" minlength="8" maxlength="72" autocomplete="new-password" required />
        </div>

        <fieldset style="border: 1px solid var(--color-borde); border-radius: var(--radio-sm); padding: var(--espacio-md);">
          <legend style="font-weight: 600; padding: 0 var(--espacio-xs); color: var(--color-texto);">Roles</legend>
          <p v-if="cargandoRoles" class="tenue" style="margin-top: var(--espacio-xs);">Cargando roles...</p>
          <div class="pila" style="margin-top: var(--espacio-sm); gap: var(--espacio-sm);">
            <label v-for="rol in roles" :key="rol.id" style="display: flex; align-items: center; gap: var(--espacio-sm); cursor: pointer; font-size: 0.875rem; color: var(--color-texto);">
              <input v-model="rolesSeleccionados" type="checkbox" :value="rol.id" />
              {{ rol.nombre }}
            </label>
          </div>
        </fieldset>

        <p v-if="error" class="aviso aviso--error" role="alert">{{ error }}</p>
        <p v-if="exito" class="aviso" role="status">{{ exito }}</p>

        <div>
          <button type="submit" class="btn btn--primario" :disabled="enviando">
            {{ enviando ? 'Creando...' : 'Crear usuario' }}
          </button>
        </div>
      </form>
    </div>
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