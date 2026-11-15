<script setup>
import { ref, computed, onMounted } from 'vue';
import { identidadApi, mensajeDeError } from '../services/identidadApi.js';
import { usuario as usuarioActual, tienePermiso } from '../services/sesion.js';

const usuarios = ref([]);
const cargando = ref(false);
const procesandoId = ref(null);
const error = ref('');
const exito = ref('');

const puedeDesactivar = computed(() => tienePermiso('usuario:desactivar'));
const miId = computed(() => usuarioActual.value?.id ?? null);

async function cargar() {
  cargando.value = true;
  try {
    usuarios.value = await identidadApi.listarUsuarios();
  } catch (e) {
    error.value = mensajeDeError(e);
  } finally {
    cargando.value = false;
  }
}

async function cambiarEstado(u) {
  error.value = '';
  exito.value = '';
  const desactivando = u.activo;

  if (desactivando && !window.confirm(`¿Desactivar a ${u.nombre} ${u.apellido}? No va a poder iniciar sesión.`)) {
    return;
  }

  procesandoId.value = u.id;
  try {
    if (desactivando) await identidadApi.desactivarUsuario(u.id);
    else await identidadApi.reactivarUsuario(u.id);
    exito.value = desactivando ? `Usuario desactivado: ${u.email}` : `Usuario reactivado: ${u.email}`;
    await cargar();
  } catch (e) {
    error.value = mensajeDeError(e);
  } finally {
    procesandoId.value = null;
  }
}

onMounted(cargar);
</script>

<template>
  <div>
    <p v-if="error" class="aviso" role="alert">{{ error }}</p>
    <p v-if="exito" class="aviso" role="status">{{ exito }}</p>

    <div class="tarjeta">
      <p v-if="cargando && usuarios.length === 0" class="tenue">Cargando usuarios...</p>

      <table v-else class="tabla">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Email</th>
            <th>Roles</th>
            <th>Estado</th>
            <th v-if="puedeDesactivar"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in usuarios" :key="u.id">
            <td>
              {{ u.apellido }}, {{ u.nombre }}
              <span v-if="u.id === miId" class="tenue">(vos)</span>
            </td>
            <td>{{ u.email }}</td>
            <td>
              <span v-for="rol in u.roles" :key="rol" class="badge">{{ rol }}</span>
              <span v-if="u.roles.length === 0" class="tenue">Sin roles</span>
            </td>
            <td>{{ u.activo ? 'Activo' : 'Inactivo' }}</td>
            <td v-if="puedeDesactivar">
              <button
                v-if="u.activo"
                type="button"
                class="btn btn--peligro"
                :disabled="procesandoId !== null || u.id === miId"
                @click="cambiarEstado(u)"
              >
                Desactivar
              </button>
              <button
                v-else
                type="button"
                class="btn"
                :disabled="procesandoId !== null"
                @click="cambiarEstado(u)"
              >
                Reactivar
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>