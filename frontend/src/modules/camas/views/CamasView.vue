<template>
  <section class="pagina">
    <div class="tabs" role="tablist">
      <button
        v-for="t in tabs"
        :key="t.id"
        role="tab"
        :aria-selected="tab === t.id"
        :class="['tab', { 'tab--activa': tab === t.id }]"
        @click="tab = t.id"
      >
        {{ t.nombre }}
        <span v-if="t.id === 'inventario' && alertas.length" class="badge">{{ alertas.length }}</span>
      </button>
      <span :class="['en-vivo', { 'en-vivo--on': conectado }]">
        {{ conectado ? 'En vivo' : 'Sin conexión en vivo' }}
      </span>
    </div>

    <MapaCamas v-if="tab === 'mapa'" :version="version" @aviso="avisar" />
    <InventarioPanel v-else :version="versionStock" :alertas="alertas" @aviso="avisar" @limpiar-alertas="alertas = []" />

    <transition-group name="aviso" tag="div" class="avisos">
      <div v-for="a in avisos" :key="a.id" :class="['aviso', a.tipo !== 'ok' && `aviso--${a.tipo}`]">{{ a.texto }}</div>
    </transition-group>
  </section>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import MapaCamas from '../components/MapaCamas.vue';
import InventarioPanel from '../components/InventarioPanel.vue';
import { escucharEnVivo } from '../services/camasApi';

const tabs = [
  { id: 'mapa', nombre: 'Mapa de camas' },
  { id: 'inventario', nombre: 'Inventario' },
];
const tab = ref('mapa');

// Cada evento en vivo sube una version y los hijos recargan.
const version = ref(0);
const versionStock = ref(0);
const conectado = ref(false);
const alertas = ref([]);
const avisos = ref([]);
let siguiente = 0;
let cerrar = null;

function avisar({ tipo = 'ok', texto }) {
  const id = ++siguiente;
  avisos.value.push({ id, tipo, texto });
  setTimeout(() => {
    avisos.value = avisos.value.filter((a) => a.id !== id);
  }, tipo === 'error' ? 6000 : 3500);
}

onMounted(() => {
  cerrar = escucharEnVivo(
    {
      CamaEstadoCambiado: () => version.value++,
      StockBajoDetectado: (c) => {
        versionStock.value++;
        alertas.value = [c, ...alertas.value.filter((a) => a.inventarioPisoId !== c.inventarioPisoId)];
        avisar({ tipo: 'alerta', texto: `Stock bajo: ${c.insumo} en piso ${c.piso} (quedan ${c.stockActual})` });
      },
    },
    (ok) => {
      // Al reconectar se recarga por si hubo cambios mientras estaba caido.
      if (ok && !conectado.value) version.value++;
      conectado.value = ok;
    }
  );
});

onBeforeUnmount(() => cerrar && cerrar());
</script>
