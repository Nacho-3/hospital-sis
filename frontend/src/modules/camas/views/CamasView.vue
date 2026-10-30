<template>
  <section class="camas">
    <div class="camas__tabs" role="tablist">
      <button
        v-for="t in tabs"
        :key="t.id"
        role="tab"
        :aria-selected="tab === t.id"
        :class="['camas__tab', { 'camas__tab--activa': tab === t.id }]"
        @click="tab = t.id"
      >
        {{ t.nombre }}
        <span v-if="t.id === 'inventario' && alertas.length" class="camas__badge">{{ alertas.length }}</span>
      </button>
      <span :class="['camas__vivo', { 'camas__vivo--on': conectado }]">
        {{ conectado ? 'En vivo' : 'Sin conexión en vivo' }}
      </span>
    </div>

    <MapaCamas v-if="tab === 'mapa'" :version="version" @aviso="avisar" />
    <InventarioPanel v-else :version="versionStock" :alertas="alertas" @aviso="avisar" @limpiar-alertas="alertas = []" />

    <transition-group name="aviso" tag="div" class="camas__avisos">
      <div v-for="a in avisos" :key="a.id" :class="['camas__aviso', `camas__aviso--${a.tipo}`]">{{ a.texto }}</div>
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

<style>
.camas {
  --c-disponible: #2e7d4f;
  --c-reservada: #2f63b8;
  --c-ocupada: #b3362c;
  --c-limpieza: #c98a12;
  --c-mantenimiento: #6b6f76;
  --c-borde: #d9dce1;
  --c-suave: #f4f5f7;
  --c-texto: #1d2127;
  --c-tenue: #5d636c;
  color: var(--c-texto);
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 16px 48px;
}
.camas__tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  border-bottom: 1px solid var(--c-borde);
  margin-bottom: 20px;
}
.camas__tab {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 10px 14px;
  font: inherit;
  font-weight: 600;
  color: var(--c-tenue);
  cursor: pointer;
}
.camas__tab--activa { color: var(--c-texto); border-bottom-color: var(--c-texto); }
.camas__badge {
  display: inline-block;
  min-width: 18px;
  padding: 0 5px;
  margin-left: 4px;
  border-radius: 9px;
  background: var(--c-ocupada);
  color: #fff;
  font-size: 12px;
  line-height: 18px;
  text-align: center;
}
.camas__vivo { margin-left: auto; font-size: 13px; color: var(--c-tenue); }
.camas__vivo::before {
  content: '';
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--c-mantenimiento);
  margin-right: 6px;
}
.camas__vivo--on::before { background: var(--c-disponible); }
.camas__avisos {
  position: fixed;
  right: 16px;
  bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 20;
}
.camas__aviso {
  padding: 10px 14px;
  border-radius: 6px;
  color: #fff;
  background: var(--c-disponible);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
  max-width: 360px;
  font-size: 14px;
}
.camas__aviso--error { background: var(--c-ocupada); }
.camas__aviso--alerta { background: var(--c-limpieza); }
.aviso-enter-from, .aviso-leave-to { opacity: 0; transform: translateY(8px); }
.aviso-enter-active, .aviso-leave-active { transition: all 0.2s ease; }

/* Piezas comunes a los dos paneles */
.camas .btn {
  font: inherit;
  font-size: 14px;
  padding: 7px 12px;
  border-radius: 6px;
  border: 1px solid var(--c-borde);
  background: #fff;
  color: var(--c-texto);
  cursor: pointer;
}
.camas .btn:hover:not(:disabled) { background: var(--c-suave); }
.camas .btn:disabled { opacity: 0.5; cursor: default; }
.camas .btn--primario { background: var(--c-texto); border-color: var(--c-texto); color: #fff; }
.camas .btn--primario:hover:not(:disabled) { background: #3a3f47; }
.camas .btn--peligro { color: var(--c-ocupada); border-color: var(--c-ocupada); }
.camas select, .camas input {
  font: inherit;
  font-size: 14px;
  padding: 6px 8px;
  border: 1px solid var(--c-borde);
  border-radius: 6px;
  background: #fff;
  color: var(--c-texto);
}
.camas .tenue { color: var(--c-tenue); font-size: 13px; }
</style>
