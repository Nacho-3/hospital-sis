
<template>
  <section v-if="haySesion" class="inicio">
    <h2>Inicio</h2>
    <p>Bienvenido/a, {{ nombreCompleto }}</p>

    <router-link v-if="tienePermiso('usuario:crear')" to="/identidad/usuarios/nuevo">
      Crear usuario
    </router-link>

    <button type="button" @click="salir">Cerrar sesión</button>
  </section>
</template>

<script setup>
  import { onMounted } from 'vue';
  import { useRouter } from 'vue-router';
  import { haySesion, nombreCompleto, tienePermiso, cerrarSesion } from '../services/sesion.js';
  
  const router = useRouter();
  
  function salir() {
    cerrarSesion();
    router.push('/login');
  }
  
  onMounted(() => {
    if (!haySesion.value) router.replace('/login');
  });
</script>

<style scoped>
.inicio__tarjeta {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-md);
}

.inicio__nombre {
  color: var(--color-texto);
  font-weight: 600;
}

.inicio__acciones {
  display: flex;
  gap: var(--espacio-md);
  align-items: center;
  margin-top: var(--espacio-xs);
}

.inicio__link {
  text-decoration: none;
}
</style>