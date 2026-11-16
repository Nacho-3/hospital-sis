<template>
  <div class="tarjeta hc-buscador">
    <form class="hc-buscador__form" @submit.prevent="buscar">
      <label class="campo hc-buscador__campo">
        Buscar paciente
        <input v-model="texto" placeholder="Nombre, apellido o documento" autofocus />
      </label>
      <button class="btn btn--primario" :disabled="texto.trim().length < 2 || buscando">
        {{ buscando ? 'Buscando…' : 'Buscar' }}
      </button>
    </form>
    <p v-if="error" class="hc-error">{{ error }}</p>
    <p v-else-if="buscado && !resultados.length" class="tenue">No se encontraron pacientes.</p>
    <ul v-if="resultados.length" class="hc-buscador__lista">
      <li v-for="p in resultados" :key="p.id">
        <button class="hc-buscador__item" @click="emit('elegir', p.id)">
          <strong>{{ p.apellido }}, {{ p.nombre }}</strong>
          <span class="tenue">{{ p.documento ? `DNI ${p.documento}` : 'Sin documento' }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { historiaApi } from '../services/historiaApi';

const emit = defineEmits(['elegir']);
const texto = ref('');
const resultados = ref([]);
const buscando = ref(false);
const buscado = ref(false);
const error = ref('');

async function buscar() {
  buscando.value = true;
  error.value = '';
  try {
    resultados.value = await historiaApi.buscar(texto.value.trim());
    buscado.value = true;
  } catch (e) {
    error.value = e.message;
  } finally {
    buscando.value = false;
  }
}
</script>
