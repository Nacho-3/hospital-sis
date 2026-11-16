<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { cerrarAviso, listarAvisos } from '../services/atencionService.js';
import { avisar } from '../services/avisos.js';

const filas = ref([]);
let reloj;
let avisado = false;

function texto(fila) {
  if (fila.tipo === 'codigo_rojo') {
    return `Código Rojo: ${fila.paciente}. Avisá a los médicos disponibles.`;
  }
  const medico = fila.medico ? ` con ${fila.medico}` : '';
  return `${fila.paciente} está en el mostrador${medico}.`;
}

async function cargar() {
  try {
    filas.value = await listarAvisos();
  } catch (e) {
    if (!avisado) avisar(e.message, 'error');
    avisado = true;
    clearInterval(reloj);
  }
}

async function cerrar(fila) {
  try {
    await cerrarAviso(fila.id);
    await cargar();
  } catch (e) {
    avisar(e.message, 'error');
  }
}

onMounted(() => {
  cargar();
  reloj = setInterval(cargar, 4000);
});
onUnmounted(() => clearInterval(reloj));
</script>

<style scoped>
.clinico {
  max-width: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--espacio-sm);
}
</style>

<template>
  <div v-if="filas.length" class="pila">
    <div v-for="fila in filas" :key="fila.id" class="aviso clinico" :class="{ 'aviso--alerta': fila.tipo === 'codigo_rojo' }">
      <span>{{ texto(fila) }}</span>
      <button class="btn" type="button" @click="cerrar(fila)">Cerrar</button>
    </div>
  </div>
</template>
