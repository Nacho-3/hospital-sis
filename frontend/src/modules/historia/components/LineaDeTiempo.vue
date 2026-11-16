<template>
  <div>
    <div class="hc-filtros">
      <button
        v-for="o in origenes"
        :key="o"
        :class="['btn', { 'btn--primario': filtro === o }]"
        @click="filtro = filtro === o ? '' : o"
      >
        {{ o }} <span class="tenue">{{ conteo[o] || 0 }}</span>
      </button>
    </div>
    <p v-if="!visibles.length" class="tenue">No hay registros.</p>
    <ol class="hc-linea">
      <li
        v-for="(e, i) in visibles"
        :key="i"
        :class="['hc-linea__item', { 'hc-linea__item--alerta': e.alerta, 'hc-linea__item--rectificado': e.rectificado }]"
      >
        <div class="hc-linea__cab">
          <span class="badge hc-badge-origen">{{ e.origen }}</span>
          <strong>{{ e.titulo }}</strong>
          <span v-if="e.rectificado" class="badge badge--alerta">Rectificado</span>
          <span class="tenue hc-linea__fecha">{{ fecha(e.fecha) }}</span>
        </div>
        <p v-if="e.detalle" class="hc-linea__detalle">{{ e.detalle }}</p>
        <p v-if="e.autor" class="tenue hc-linea__autor">{{ e.autor }}</p>
      </li>
    </ol>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { fecha } from '../services/historiaApi';

const props = defineProps({ entradas: { type: Array, required: true } });
const filtro = ref('');
const origenes = ['Historia clínica', 'Atención', 'Camas', 'Admisión'];
const conteo = computed(() => {
  const n = {};
  for (const e of props.entradas) n[e.origen] = (n[e.origen] || 0) + 1;
  return n;
});
const visibles = computed(() => (filtro.value ? props.entradas.filter((e) => e.origen === filtro.value) : props.entradas));
</script>
