<template>
  <section class="pagina pila">
    <h2>Usuarios</h2>

    <p v-if="!puedeVer" class="aviso aviso--error" role="alert">No tenés permiso para ver los usuarios.</p>

    <template v-else>
      <p v-if="error" class="aviso aviso--error" role="alert">{{ error }}</p>
      <p v-if="exito" class="aviso" role="status">{{ exito }}</p>

      <div class="tarjeta pila">
        <div>
          <router-link v-if="puedeCrear" to="/identidad/usuarios/nuevo" class="btn btn--primario">
            Nuevo usuario
          </router-link>
        </div>

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
            <tr v-for="u in usuarios" :key="u.id" :class="{ 'fila--peligro': !u.activo }">
              <td>
                {{ u.apellido }}, {{ u.nombre }}
                <span v-if="u.id === miId" class="tenue">(vos)</span>
              </td>
              <td>{{ u.email }}</td>
              <td>
                <span v-for="rol in u.roles" :key="rol" class="badge" style="margin-right: 4px;">{{ rol }}</span>
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
    </template>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { identidadApi } from '../services/identidadApi.js';
import { usuario as usuarioActual, haySesion, tienePermiso } from '../services/sesion.js';

const router = useRouter();

const usuarios = ref([]);
const cargando = ref(false);
const procesandoId = ref(null);
const error = ref('');
const exito = ref('');

const puedeVer = computed(() => tienePermiso('usuario:ver'));
const puedeDesactivar = computed(() => tienePermiso('usuario:desactivar'));
const puedeCrear = computed(() => tienePermiso('usuario:crear'));
const miId = computed(() => usuarioActual.value?.id ?? null);

function irAlLogin() {
  router.push({ path: '/login', query: { volver: '/identidad/usuarios' } });
}

function mensajeDe(e) {
  return e.status ? e.message : 'No se pudo conectar con el servidor';
}

async function cargar() {
  cargando.value = true;
  try {
    usuarios.value = await identidadApi.listarUsuarios();
  } catch (e) {
    if (e.status === 401) return irAlLogin();
    error.value = mensajeDe(e);
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
    if (e.status === 401) return irAlLogin();
    error.value = mensajeDe(e);
  } finally {
    procesandoId.value = null;
  }
}

onMounted(() => {
  if (!haySesion.value) return irAlLogin();
  if (puedeVer.value) cargar();
});
</script>