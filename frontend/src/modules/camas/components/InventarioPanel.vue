<template>
  <div class="inv">
    <div v-if="alertas.length" class="inv__alertas">
      <div class="inv__alertas-cab">
        <strong>Alertas de reposición</strong>
        <button class="btn" @click="emit('limpiar-alertas')">Descartar</button>
      </div>
      <ul>
        <li v-for="a in alertas" :key="a.inventarioPisoId">
          {{ a.insumo }} · piso {{ a.piso }}: quedan {{ a.stockActual }} (mínimo {{ a.stockMinimo }})
        </li>
      </ul>
    </div>

    <div class="inv__barra">
      <label class="tenue">
        Piso
        <select v-model="filtroPiso">
          <option value="">Todos</option>
          <option v-for="p in pisos" :key="p" :value="p">{{ p }}</option>
        </select>
      </label>
      <label class="tenue"><input v-model="soloBajo" type="checkbox" /> Solo stock bajo</label>
    </div>

    <p v-if="error" class="inv__error">{{ error }}</p>

    <table class="tabla">
      <thead>
        <tr>
          <th>Piso</th>
          <th>Insumo</th>
          <th class="num">Stock</th>
          <th class="num">Mínimo</th>
          <th v-if="puedeReponer">Reponer</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <template v-for="r in filas" :key="r.id">
          <tr :class="{ 'inv__bajo': r.stock_bajo }">
            <td>{{ r.piso }}</td>
            <td>
              {{ r.insumo }}
              <span class="tenue">· {{ r.unidad_medida }}</span>
              <span v-if="r.stock_bajo" class="badge">Stock bajo</span>
            </td>
            <td class="num"><strong>{{ r.stock_actual }}</strong></td>
            <td class="num">{{ r.stock_minimo }}</td>
            <td v-if="puedeReponer">
              <form class="inv__reponer" @submit.prevent="reponer(r)">
                <input v-model.number="cantidades[r.id]" type="number" min="1" placeholder="Cant." />
                <button class="btn" :disabled="!(cantidades[r.id] > 0)">Sumar</button>
              </form>
            </td>
            <td><button class="btn" @click="verMovimientos(r)">{{ abierto === r.id ? 'Ocultar' : 'Movimientos' }}</button></td>
          </tr>
          <tr v-if="abierto === r.id" class="inv__movs">
            <td :colspan="puedeReponer ? 6 : 5">
              <p v-if="!movimientos.length" class="tenue">Sin movimientos.</p>
              <ul>
                <li v-for="m in movimientos" :key="m.id">
                  <span :class="m.cantidad < 0 ? 'inv__menos' : 'inv__mas'">{{ m.cantidad > 0 ? '+' : '' }}{{ m.cantidad }}</span>
                  → {{ m.stock_resultante }} · {{ MOTIVOS[m.motivo] }}
                  <template v-if="m.paciente_id"> · {{ m.paciente_apellido }}, {{ m.paciente_nombre }}</template>
                  <span class="tenue"> · {{ fecha(m.creado_en) }}</span>
                </li>
              </ul>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
    <p v-if="!filas.length && !error" class="tenue">No hay registros con ese filtro.</p>

    <form v-if="puedeReponer" class="tarjeta inv__alta" @submit.prevent="configurar">
      <strong>Agregar insumo a un piso o cambiar su mínimo</strong>
      <div class="inv__alta-campos">
        <input v-model.number="alta.piso" type="number" placeholder="Piso" />
        <select v-model="alta.insumoId">
          <option value="">Insumo…</option>
          <option v-for="i in insumos" :key="i.id" :value="i.id">{{ i.nombre }}</option>
        </select>
        <input v-model.number="alta.stockMinimo" type="number" min="0" placeholder="Stock mínimo" />
        <input v-model.number="alta.stockInicial" type="number" min="0" placeholder="Stock inicial (si es nuevo)" />
        <button class="btn btn--primario" :disabled="alta.piso === '' || !alta.insumoId">Guardar</button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { camasApi } from '../services/camasApi';
import { puede, PERMISOS } from '../services/sesion';

// Reponer y dar de alta insumos: solo con inventario:reponer.
const puedeReponer = computed(() => puede(PERMISOS.REPONER_INVENTARIO));

const props = defineProps({
  version: { type: Number, default: 0 },
  alertas: { type: Array, default: () => [] },
});
const emit = defineEmits(['aviso', 'limpiar-alertas']);

const MOTIVOS = {
  medicacion_administrada: 'Medicación administrada',
  reposicion: 'Reposición',
  ajuste: 'Ajuste',
};

const registros = ref([]);
const insumos = ref([]);
const error = ref('');
const filtroPiso = ref('');
const soloBajo = ref(false);
const cantidades = reactive({});
const abierto = ref(null);
const movimientos = ref([]);
const alta = reactive({ piso: '', insumoId: '', stockMinimo: '', stockInicial: '' });

async function cargar() {
  try {
    registros.value = await camasApi.inventario();
    error.value = '';
  } catch (e) {
    error.value = `No se pudo cargar el inventario: ${e.message}`;
  }
  if (abierto.value) movimientos.value = await camasApi.movimientos(abierto.value).catch(() => []);
}

onMounted(async () => {
  await cargar();
  insumos.value = await camasApi.insumos().catch(() => []);
});
watch(() => props.version, cargar);

const pisos = computed(() => [...new Set(registros.value.map((r) => r.piso))]);
const filas = computed(() =>
  registros.value.filter(
    (r) => (filtroPiso.value === '' || r.piso === Number(filtroPiso.value)) && (!soloBajo.value || r.stock_bajo)
  )
);

async function reponer(r) {
  try {
    await camasApi.reponer(r.id, cantidades[r.id]);
    emit('aviso', { texto: `Se sumaron ${cantidades[r.id]} de ${r.insumo}` });
    cantidades[r.id] = undefined;
    await cargar();
  } catch (e) {
    emit('aviso', { tipo: 'error', texto: e.message });
  }
}

async function verMovimientos(r) {
  if (abierto.value === r.id) {
    abierto.value = null;
    return;
  }
  abierto.value = r.id;
  movimientos.value = await camasApi.movimientos(r.id).catch(() => []);
}

async function configurar() {
  try {
    await camasApi.configurarInventario({
      piso: alta.piso,
      insumoId: Number(alta.insumoId),
      stockMinimo: alta.stockMinimo === '' ? 0 : alta.stockMinimo,
      stockInicial: alta.stockInicial === '' ? 0 : alta.stockInicial,
    });
    emit('aviso', { texto: 'Inventario guardado' });
    Object.assign(alta, { piso: '', insumoId: '', stockMinimo: '', stockInicial: '' });
    await cargar();
  } catch (e) {
    emit('aviso', { tipo: 'error', texto: e.message });
  }
}

const fecha = (v) => new Date(v).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
</script>

<style>
.inv__alertas {
  border: 1px solid var(--color-alerta);
  background: var(--color-alerta-fondo);
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 16px;
  font-size: 14px;
}
.inv__alertas-cab { display: flex; justify-content: space-between; align-items: center; }
.inv__alertas ul { margin: 6px 0 0; padding-left: 18px; }
.inv__barra { display: flex; gap: 16px; align-items: center; margin-bottom: 12px; }
.inv__error { color: var(--color-peligro); }
.inv__bajo td { background: var(--color-peligro-fondo); }
.inv__reponer { display: flex; gap: 6px; }
.inv__reponer input { width: 70px; }
.inv__movs td { background: var(--color-suave); }
.inv__movs ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.inv__menos { color: var(--color-peligro); font-weight: 700; }
.inv__mas { color: var(--color-exito); font-weight: 700; }
.inv__alta { margin-top: var(--espacio-lg); font-size: 0.875rem; }
.inv__alta-campos { display: flex; flex-wrap: wrap; gap: var(--espacio-sm); margin-top: var(--espacio-sm); }
.inv__alta-campos input { width: 140px; }
</style>
