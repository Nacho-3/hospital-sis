<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { haySesion, tienePermiso } from '../services/sesion.js';
import UsuariosLista from '../components/UsuariosLista.vue';
import UsuarioNuevo from '../components/UsuarioNuevo.vue';
import RolesPermisos from '../components/RolesPermisos.vue';

const router = useRouter();

const PESTANAS = [
  { clave: 'usuarios', titulo: 'Usuarios', permiso: 'usuario:ver' },
  { clave: 'nuevo', titulo: 'Nuevo usuario', permiso: 'usuario:crear' },
  { clave: 'roles', titulo: 'Roles y permisos', permiso: 'rol:administrar' },
];

const pestanaElegida = ref(null);

const pestanasVisibles = computed(() => PESTANAS.filter((p) => tienePermiso(p.permiso)));
const pestanaActiva = computed(
  () =>
    pestanasVisibles.value.find((p) => p.clave === pestanaElegida.value) ??
    pestanasVisibles.value[0] ??
    null
);

function elegirPestana(clave) {
  pestanaElegida.value = clave;
}

onMounted(() => {
  if (!haySesion.value) router.push({ path: '/login', query: { volver: '/identidad' } });
});
</script>

<template>
  <section class="pagina">
    <h2>Identidad y accesos</h2>

    <p v-if="!haySesion" class="aviso" role="alert">
      Tu sesión terminó. <router-link to="/login">Iniciá sesión de nuevo</router-link>.
    </p>

    <p v-else-if="pestanasVisibles.length === 0" class="aviso" role="alert">
      No tenés permisos para administrar usuarios ni roles.
    </p>

    <template v-else>
      <nav>
        <button
          v-for="p in pestanasVisibles"
          :key="p.clave"
          type="button"
          class="tab"
          :class="{ 'tab--activa': p.clave === pestanaActiva.clave }"
          :aria-current="p.clave === pestanaActiva.clave ? 'page' : undefined"
          @click="elegirPestana(p.clave)"
        >
          {{ p.titulo }}
        </button>
      </nav>

      <UsuariosLista v-if="pestanaActiva.clave === 'usuarios'" />
      <UsuarioNuevo v-else-if="pestanaActiva.clave === 'nuevo'" />
      <RolesPermisos v-else-if="pestanaActiva.clave === 'roles'" />
    </template>
  </section>
</template>