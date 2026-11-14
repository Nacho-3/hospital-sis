<!-- components/NotasPanel.vue -->
<script setup>
import { ref, watch } from 'vue';
import { listarNotas, crearNota } from '../services/atencionService.js';
import { avisar } from '../services/avisos.js';
import { fechaHora } from '../services/formato.js';

const props = defineProps({ pacienteId: { type: Number, default: null } });
const notas = ref([]);
const texto = ref('');

async function cargar() {
  notas.value = props.pacienteId ? await listarNotas(props.pacienteId) : [];
}
watch(() => props.pacienteId, () => cargar().catch((e) => avisar(e.message, 'error')), { immediate: true });

async function agregar() {
  if (!texto.value.trim()) return;
  try {
    await crearNota(props.pacienteId, texto.value.trim());
    texto.value = '';
    avisar('Nota agregada.');
    await cargar();
  } catch (e) { avisar(e.message, 'error'); }
}
</script>

<template>
  <div class="pila">
    <form class="tarjeta pila" @submit.prevent="agregar">
      <label class="campo">Nueva nota de enfermería
        <textarea v-model="texto" rows="3" />
      </label>
      <div><button class="btn btn--primario" :disabled="!pacienteId || !texto.trim()">Agregar nota</button></div>
    </form>
    <div class="tarjeta">
      <table class="tabla">
        <thead><tr><th>Fecha</th><th>Origen</th><th>Nota</th></tr></thead>
        <tbody>
          <tr v-for="n in notas" :key="n.id">
            <td>{{ fechaHora(n.creadoEn) }}</td>
            <td class="tenue">{{ n.automatica ? 'Automática' : 'Manual' }}</td>
            <td>{{ n.texto }}</td>
          </tr>
          <tr v-if="!notas.length"><td colspan="3" class="tenue">Sin notas.</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>