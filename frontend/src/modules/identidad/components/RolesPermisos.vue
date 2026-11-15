<script setup>
import { ref, computed, onMounted } from 'vue';
import { identidadApi, mensajeDeError } from '../services/identidadApi.js';

const roles = ref([]);
const permisos = ref([]);
const rolElegidoId = ref(null);
const seleccionados = ref([]);
const cargando = ref(false);
const guardando = ref(false);
const error = ref('');
const exito = ref('');

const permisosPorGrupo = computed(() => {
  const grupos = {};
  for (const permiso of permisos.value) {
    const grupo = permiso.codigo.split(':')[0];
    if (!grupos[grupo]) grupos[grupo] = [];
    grupos[grupo].push(permiso);
  }
  return grupos;
});

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
    error.value = mensajeDeError(e);
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
    error.value = mensajeDeError(e);
  }
}

async function guardar() {
  if (rolElegidoId.value === null) return;
  error.value = '';
  exito.value = '';
  guardando.value = true;
  try {
    await identidadApi.guardarPermisosDeRol(rolElegidoId.value, seleccionados.value);
    exito.value =
      'Permisos guardados. Los usuarios con este rol deben volver a iniciar sesión para que el cambio les aplique.';
  } catch (e) {
    error.value = mensajeDeError(e);
  } finally {
    guardando.value = false;
  }
}

onMounted(cargarBase);
</script>

<template>
  <div>
    <p v-if="error" class="aviso" role="alert">{{ error }}</p>
    <p v-if="exito" class="aviso" role="status">{{ exito }}</p>
    <p v-if="cargando" class="tenue">Cargando...</p>

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
  </div>
</template>