<template>
  <div class="mapa">
    <div class="mapa__barra">
      <div class="mapa__leyenda">
        <button
          v-for="(info, estado) in ESTADOS"
          :key="estado"
          :class="['mapa__chip', { 'mapa__chip--off': filtroEstado && filtroEstado !== estado }]"
          @click="filtroEstado = filtroEstado === estado ? '' : estado"
        >
          <span class="mapa__punto" :style="{ background: info.color }"></span>
          {{ info.etiqueta }} <strong>{{ conteo[estado] || 0 }}</strong>
        </button>
      </div>
      <label class="tenue">
        Piso
        <select v-model="filtroPiso">
          <option value="">Todos</option>
          <option v-for="p in pisos" :key="p" :value="p">{{ nombrePiso(p) }}</option>
        </select>
      </label>
    </div>

    <p v-if="cargando && !camas.length" class="tenue">Cargando camas…</p>
    <p v-else-if="error" class="mapa__error">{{ error }}</p>

    <div class="mapa__cuerpo">
      <div class="mapa__pisos">
        <section v-for="grupo in agrupado" :key="grupo.piso" class="mapa__piso">
          <h2 class="mapa__piso-titulo">{{ nombrePiso(grupo.piso) }}</h2>
          <div class="mapa__habitaciones">
            <div v-for="hab in grupo.habitaciones" :key="hab.id" class="mapa__habitacion">
              <div class="mapa__hab-titulo">
                Hab. {{ hab.numero }}
                <span class="tenue">{{ TIPOS_HABITACION[hab.tipo] }} · {{ hab.camas.length }}/{{ hab.capacidad }}</span>
              </div>
              <div class="mapa__camas">
                <button
                  v-for="c in hab.camas"
                  :key="c.id"
                  :class="['mapa__cama', { 'mapa__cama--sel': seleccionada === c.id }]"
                  :style="{ '--estado': ESTADOS[c.estado].color }"
                  @click="seleccionada = c.id"
                >
                  <span class="mapa__cama-codigo">{{ c.codigo }}</span>
                  <span class="mapa__cama-estado">{{ ESTADOS[c.estado].etiqueta }}</span>
                  <span v-if="c.paciente_id" class="mapa__cama-paciente">{{ c.paciente_apellido }}, {{ c.paciente_nombre }}</span>
                  <span v-else-if="c.reservada_para_paciente_id" class="mapa__cama-paciente">
                    Para {{ c.reservada_para_apellido }}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </section>
        <p v-if="!cargando && !agrupado.length && !error" class="tenue">No hay camas con ese filtro.</p>
      </div>

      <CamaPanel
        v-if="camaSeleccionada"
        :cama="camaSeleccionada"
        :camas="camas"
        :version="version"
        @cerrar="seleccionada = null"
        @hecho="alTerminar"
        @aviso="(a) => emit('aviso', a)"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import CamaPanel from './CamaPanel.vue';
import { camasApi, ESTADOS, TIPOS_HABITACION } from '../services/camasApi';

const props = defineProps({ version: { type: Number, default: 0 } });
const emit = defineEmits(['aviso']);

const camas = ref([]);
const cargando = ref(false);
const error = ref('');
const filtroEstado = ref('');
const filtroPiso = ref('');
const seleccionada = ref(null);

async function cargar() {
  cargando.value = true;
  try {
    camas.value = await camasApi.mapa();
    error.value = '';
  } catch (e) {
    error.value = `No se pudo cargar el mapa: ${e.message}`;
  } finally {
    cargando.value = false;
  }
}

onMounted(cargar);
// Un evento en vivo (otra pantalla cambio una cama) recarga el mapa.
watch(() => props.version, cargar);

function alTerminar(texto) {
  emit('aviso', { texto });
  cargar();
}

const nombrePiso = (p) => (Number(p) === 0 ? 'Planta baja' : `Piso ${p}`);
const pisos = computed(() => [...new Set(camas.value.map((c) => c.piso))]);
const camaSeleccionada = computed(() => camas.value.find((c) => c.id === seleccionada.value) || null);

const conteo = computed(() => {
  const n = {};
  for (const c of camas.value) {
    if (filtroPiso.value !== '' && c.piso !== Number(filtroPiso.value)) continue;
    n[c.estado] = (n[c.estado] || 0) + 1;
  }
  return n;
});

// piso -> habitacion -> camas, respetando los filtros.
const agrupado = computed(() => {
  const pisosMap = new Map();
  for (const c of camas.value) {
    if (filtroEstado.value && c.estado !== filtroEstado.value) continue;
    if (filtroPiso.value !== '' && c.piso !== Number(filtroPiso.value)) continue;
    if (!pisosMap.has(c.piso)) pisosMap.set(c.piso, new Map());
    const habs = pisosMap.get(c.piso);
    if (!habs.has(c.habitacion_id)) {
      habs.set(c.habitacion_id, {
        id: c.habitacion_id,
        numero: c.habitacion,
        tipo: c.tipo,
        capacidad: c.capacidad,
        camas: [],
      });
    }
    habs.get(c.habitacion_id).camas.push(c);
  }
  return [...pisosMap.entries()].map(([piso, habs]) => ({ piso, habitaciones: [...habs.values()] }));
});
</script>

<style>
.mapa__barra {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.mapa__leyenda { display: flex; flex-wrap: wrap; gap: 6px; }
.mapa__chip {
  font: inherit;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 999px;
  border: 1px solid var(--color-borde);
  background: var(--color-superficie);
  color: var(--color-texto);
  cursor: pointer;
}
.mapa__chip--off { opacity: 0.45; }
.mapa__punto { width: 10px; height: 10px; border-radius: 50%; }
.mapa__error { color: var(--color-peligro); }
.mapa__cuerpo { display: flex; gap: 20px; align-items: flex-start; }
.mapa__pisos { flex: 1; min-width: 0; }
.mapa__piso { margin-bottom: 24px; }
.mapa__piso-titulo { font-size: 15px; text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 10px; color: var(--color-tenue); }
.mapa__habitaciones { display: flex; flex-wrap: wrap; gap: 12px; }
.mapa__habitacion { border: 1px solid var(--color-borde); border-radius: 8px; padding: 10px; background: var(--color-suave); }
.mapa__hab-titulo { font-weight: 600; font-size: 14px; margin-bottom: 8px; display: flex; gap: 8px; align-items: baseline; }
.mapa__camas { display: flex; flex-wrap: wrap; gap: 8px; }
.mapa__cama {
  font: inherit;
  text-align: left;
  width: 150px;
  min-height: 72px;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--color-borde);
  border-left: 5px solid var(--estado);
  background: var(--color-superficie);
  color: var(--color-texto);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.mapa__cama:hover { box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); }
.mapa__cama--sel { outline: 2px solid var(--color-texto); outline-offset: 1px; }
.mapa__cama-codigo { font-weight: 700; }
.mapa__cama-estado { font-size: 12px; font-weight: 600; color: var(--estado); }
.mapa__cama-paciente { font-size: 12px; color: var(--color-tenue); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 800px) {
  .mapa__cuerpo { flex-direction: column-reverse; }
  .mapa__cama { width: calc(50vw - 48px); }
}
</style>
