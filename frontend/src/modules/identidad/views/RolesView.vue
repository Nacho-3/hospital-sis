<template>
  <section class="pagina">
    <h2>Roles y permisos</h2>

    <p v-if="!puedeAdministrar" class="aviso" role="alert">No tenés permiso para administrar roles.</p>

    <template v-else>
      <p v-if="error" class="aviso" role="alert">{{ error }}</p>
      <p v-if="exito" class="aviso" role="status">{{ exito }}</p>
      <p v-if="cargando" class="tenue">Cargando...</p>

      <div class="tarjeta">
        <h3>Crear rol</h3>
        <form @submit.prevent="crearRol">
          <div class="campo">
            <label for="rol-codigo">Código (por ejemplo AUDITOR)</label>
            <input id="rol-codigo" v-model="codigoNuevo" type="text" maxlength="40" required />
          </div>
          <div class="campo">
            <label for="rol-nombre">Nombre</label>
            <input id="rol-nombre" v-model="nombreNuevo" type="text" maxlength="80" required />
          </div>
          <button type="submit" class="btn btn--primario" :disabled="creando">
            {{ creando ? 'Creando...' : 'Crear rol' }}
          </button>
        </form>
      </div>

      <div class="tarjeta">
        <h3>Permisos de un rol</h3>
        <div class="campo">
          <label for="rol-elegido">Rol</label>
          <select id="rol-elegido" :value="rolElegidoId ?? ''" @change="elegirRol($event.target.value)">
            <option value="">Elegí un rol</option>
            <option v-for="rol in roles" :key="rol.id" :value="rol.id">{{ rol.nombre }}</option>
          </select>
        </div>

        <template v-if="rolElegidoId !== null">
          <fieldset v-for="(lista, grupo) in permisosPorGrupo" :key="grupo">
            <legend>{{ grupo }}</legend>
            <label v-for="permiso in lista" :key="permiso.id">
              <input v-model="seleccionados" type="checkbox" :value="permiso.id" />
              {{ permiso.codigo }}
              <span class="tenue">{{ permiso.descripcion }}</span>
            </label>
          </fieldset>

          <button type="button" class="btn btn--primario" :disabled="guardando" @click="guardar">
            {{ guardando ? 'Guardando...' : 'Guardar permisos' }}
          </button>
        </template>
      </div>
    </template>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { identidadApi } from '../services/identidadApi.js';
import { haySesion, tienePermiso } from '../services/sesion.js';

const router = useRouter();

const roles = ref([]);
const permisos = ref([]);
const rolElegidoId = ref(null);
const seleccionados = ref([]);

const codigoNuevo = ref('');
const nombreNuevo = ref('');

const cargando = ref(false);
const creando = ref(false);
const guardando = ref(false);
const error = ref('');
const exito = ref('');

const puedeAdministrar = computed(() => tienePermiso('rol:administrar'));

const permisosPorGrupo = computed(() => {
  const grupos = {};
  for (const permiso of permisos.value) {
    const grupo = permiso.codigo.split(':')[0];
    if (!grupos[grupo]) grupos[grupo] = [];
    grupos[grupo].push(permiso);
  }
  return grupos;
});

function irAlLogin() {
  router.push({ path: '/login', query: { volver: '/identidad/roles' } });
}

function mensajeDe(e) {
  return e.status ? e.message : 'No se pudo conectar con el servidor';
}

async function cargarBase() {
  cargando.value = true;
  try {
    const [listaRoles, listaPermisos] = await Promise.all([
      identidadApi.listarRoles(),
      identidadApi.listarPermisos(),
    ]);
    roles.value = listaRoles;
    permisos.value = listaPermisos;
  } catch (e) {
    if (e.status === 401) return irAlLogin();
    error.value = mensajeDe(e);
  } finally {
    cargando.value = false;
  }
}

async function elegirRol(valor) {
  error.value = '';
  exito.value = '';
  seleccionados.value = [];
  rolElegidoId.value = valor === '' ? null : Number(valor);
  if (rolElegidoId.value === null) return;

  const idPedido = rolElegidoId.value;
  try {
    const respuesta = await identidadApi.permisosDeRol(idPedido);
    if (rolElegidoId.value === idPedido) seleccionados.value = respuesta.permisos;
  } catch (e) {
    if (e.status === 401) return irAlLogin();
    error.value = mensajeDe(e);
  }
}

async function crearRol() {
  error.value = '';
  exito.value = '';
  creando.value = true;
  try {
    const respuesta = await identidadApi.crearRol({
      codigo: codigoNuevo.value,
      nombre: nombreNuevo.value,
    });
    exito.value = `Rol creado: ${respuesta.rol.nombre}. Ahora elegilo en la lista para asignarle permisos.`;
    codigoNuevo.value = '';
    nombreNuevo.value = '';
    roles.value = await identidadApi.listarRoles();
  } catch (e) {
    if (e.status === 401) return irAlLogin();
    error.value = mensajeDe(e);
  } finally {
    creando.value = false;
  }
}

async function guardar() {
  if (rolElegidoId.value === null) return;
  error.value = '';
  exito.value = '';
  guardando.value = true;
  try {
    await identidadApi.guardarPermisosDeRol(rolElegidoId.value, seleccionados.value);
    exito.value = 'Permisos guardados. Los usuarios con este rol deben volver a iniciar sesión para que el cambio les aplique.';
  } catch (e) {
    if (e.status === 401) return irAlLogin();
    error.value = mensajeDe(e);
  } finally {
    guardando.value = false;
  }
}

onMounted(() => {
  if (!haySesion.value) return irAlLogin();
  if (puedeAdministrar.value) cargarBase();
});
</script>