<template>
  <div class="tarjeta">
    <div class="tabs" role="tablist">
      <button
        v-for="f in filtros"
        :key="f.id"
        type="button"
        role="tab"
        :aria-selected="filtro === f.id"
        :class="['tab', { 'tab--activa': filtro === f.id }]"
        @click="filtro = f.id"
      >
        {{ f.etiqueta }} <span :class="['badge', f.clase]">{{ f.cantidad }}</span>
      </button>
    </div>

    <table class="tabla">
      <thead>
        <tr>
          <th>Fecha y hora</th>
          <th>Concepto</th>
          <th>Destinatario</th>
          <th>Responsable de pago</th>
          <th>Origen</th>
          <th class="num">Monto</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="cargo in visibles" :key="cargo.id">
          <td class="tenue">{{ formatearFecha(cargo.creado_en) }}</td>
          <td><strong>{{ cargo.concepto }}</strong></td>
          <td>
            <span :class="['badge', DESTINATARIOS[cargo.destinatario]?.clase]">
              {{ DESTINATARIOS[cargo.destinatario]?.etiqueta ?? cargo.destinatario }}
            </span>
          </td>
          <td>{{ cargo.destinatario_nombre }}</td>
          <td class="tenue">{{ cargo.evento_origen || 'Manual' }}</td>
          <td class="num"><strong>{{ formatearMonto(cargo.monto) }}</strong></td>
        </tr>
        <tr v-if="visibles.length === 0">
          <td colspan="6" class="tenue cargos__vacio">No hay cargos para este filtro en la cuenta activa.</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { DESTINATARIOS, formatearFecha, formatearMonto } from '../services/formato';

const props = defineProps({
  cargos: { type: Array, required: true },
});

const TODOS = 'todos';
const filtro = ref(TODOS);

const de = (destinatario) => props.cargos.filter((c) => c.destinatario === destinatario);

const filtros = computed(() => [
  { id: TODOS, etiqueta: 'Todos', clase: '', cantidad: props.cargos.length },
  ...Object.entries(DESTINATARIOS).map(([id, { etiqueta, clase }]) => ({
    id,
    etiqueta,
    clase,
    cantidad: de(id).length,
  })),
]);

const visibles = computed(() => (filtro.value === TODOS ? props.cargos : de(filtro.value)));
</script>

<style>
.tabla .cargos__vacio { text-align: center; padding: var(--espacio-lg); }
</style>
