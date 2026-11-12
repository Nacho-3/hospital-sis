<template>
  <div class="tarjeta">
    <p class="tenue">Cobertura vigente</p>
    <div class="cob__titulo">
      <h2>{{ cobertura.nombre }}</h2>
      <span :class="['badge', tipo.clase]">{{ tipo.etiqueta }}</span>
    </div>
    <p class="tenue">
      <template v-if="cobertura.copago_fijo">
        Copago fijo por cargo: <strong>{{ formatearMonto(cobertura.copago_fijo) }}</strong>
      </template>
      <template v-else>Sin copago fijo</template>
    </p>

    <form class="cob__cambio" @submit.prevent="emit('cambiar', seleccion)">
      <label class="campo">
        <span>Cambiar cobertura</span>
        <select v-model="seleccion">
          <option :value="null">Sin cobertura (particular)</option>
          <option v-for="c in coberturas" :key="c.id" :value="c.id">{{ c.nombre }}</option>
        </select>
      </label>
      <button class="btn" :disabled="ocupado || seleccion === cobertura.id">Guardar</button>
    </form>
    <p class="tenue">El cambio vale para los cargos nuevos: los ya generados no se recalculan.</p>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { TIPOS_COBERTURA, formatearMonto } from '../services/formato';

const props = defineProps({
  // Cobertura vigente del paciente. id null = particular.
  cobertura: { type: Object, required: true },
  // Catalogo para el selector.
  coberturas: { type: Array, required: true },
  ocupado: { type: Boolean, default: false },
});
const emit = defineEmits(['cambiar']);

const seleccion = ref(props.cobertura.id);
watch(() => props.cobertura.id, (id) => { seleccion.value = id; });

const tipo = computed(() => TIPOS_COBERTURA[props.cobertura.tipo] ?? { etiqueta: props.cobertura.tipo, clase: '' });
</script>

<style>
.cob__titulo { display: flex; flex-wrap: wrap; align-items: center; gap: var(--espacio-xs) var(--espacio-sm); margin: var(--espacio-xs) 0; }
.cob__titulo h2 { margin: 0; }
.cob__cambio {
  display: flex;
  align-items: flex-end;
  gap: var(--espacio-sm);
  margin: var(--espacio-sm) 0 var(--espacio-xs);
  padding-top: var(--espacio-sm);
  border-top: 1px solid var(--color-borde);
}
.cob__cambio .campo { flex: 1; min-width: 0; }
</style>
