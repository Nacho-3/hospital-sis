<template>
  <section class="pagina pila">
    <h1>Historia clínica</h1>

    <p v-if="!puede(PERMISOS.VER)" class="aviso aviso--error">
      Tu usuario no tiene permiso para ver historias clínicas.
    </p>

    <template v-else>
      <BuscadorPacientes v-if="!pacienteId" @elegir="elegir" />

      <p v-if="error" class="aviso aviso--error">{{ error }}</p>
      <p v-if="cargando && !resumen" class="tenue">Cargando…</p>

      <template v-if="pacienteId && resumen">
        <CabeceraPaciente :resumen="resumen" @cambiar="cambiarPaciente" />

        <div class="tabs hc-tabs" role="tablist">
          <button
            v-for="t in TABS"
            :key="t.id"
            role="tab"
            :class="['tab', { 'tab--activa': tab === t.id }]"
            @click="tab = t.id"
          >
            {{ t.texto }}
          </button>
        </div>

        <div v-if="tab === 'resumen'" class="rejilla hc-resumen">
          <div class="tarjeta">
            <h3>Antecedentes</h3>
            <p v-if="!resumen.antecedentes.length" class="tenue">Sin antecedentes.</p>
            <ul class="hc-lista-simple">
              <li v-for="a in resumen.antecedentes" :key="a.id">
                <strong>{{ CONFIG.antecedente.titulo(a) }}:</strong> {{ a.descripcion }}
              </li>
            </ul>
          </div>
          <div class="tarjeta">
            <h3>Última evolución</h3>
            <template v-if="resumen.ultimaEvolucion">
              <p><strong>{{ resumen.ultimaEvolucion.diagnostico || 'Evolución médica' }}</strong></p>
              <p class="hc-registro__texto">{{ resumen.ultimaEvolucion.texto }}</p>
              <p class="tenue">{{ fecha(resumen.ultimaEvolucion.registrado_en) }} · {{ nombre(resumen.ultimaEvolucion) }}</p>
            </template>
            <p v-else class="tenue">Sin evoluciones.</p>
          </div>
          <div class="tarjeta hc-resumen__ancho">
            <h3>Actividad reciente</h3>
            <LineaDeTiempo :entradas="linea.slice(0, 8)" />
          </div>
        </div>

        <SeccionRegistros
          v-else-if="CONFIG[tab]"
          :key="tab"
          :paciente-id="pacienteId"
          :entidad="tab"
          :config="CONFIG[tab]"
          :registros="listas[tab] || []"
          :puede-registrar="puede(tab === 'evolucion' ? PERMISOS.EVOLUCIONAR : PERMISOS.REGISTRAR)"
          :puede-rectificar="puede(PERMISOS.RECTIFICAR)"
          @cambio="recargar"
        />

        <div v-else-if="tab === 'linea'" class="tarjeta">
          <p class="tenue">
            Todo lo registrado sobre el paciente: la historia clínica y lo que cargaron Admisión, Camas y Atención.
          </p>
          <LineaDeTiempo :entradas="linea" />
        </div>
      </template>
    </template>
  </section>
</template>

<script setup>
import { ref, reactive, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BuscadorPacientes from '../components/BuscadorPacientes.vue';
import CabeceraPaciente from '../components/CabeceraPaciente.vue';
import SeccionRegistros from '../components/SeccionRegistros.vue';
import LineaDeTiempo from '../components/LineaDeTiempo.vue';
import { CONFIG } from './configRegistros';
import { historiaApi, puede, PERMISOS, fecha, nombre } from '../services/historiaApi';
import '../historia.css';

const TABS = [
  { id: 'resumen', texto: 'Resumen' },
  { id: 'alergia', texto: 'Alergias' },
  { id: 'antecedente', texto: 'Antecedentes' },
  { id: 'evolucion', texto: 'Evoluciones' },
  { id: 'estudio', texto: 'Estudios' },
  { id: 'linea', texto: 'Línea de tiempo' },
];

const route = useRoute();
const router = useRouter();
const pacienteId = ref(null);
const resumen = ref(null);
const linea = ref([]);
const listas = reactive({});
const tab = ref('resumen');
const cargando = ref(false);
const error = ref('');

// El paciente elegido va en la URL (/historia?paciente=12) para poder
// recargar la pagina o compartir el enlace.
watch(
  () => route.query.paciente,
  (q) => {
    const id = Number(q);
    pacienteId.value = Number.isInteger(id) && id > 0 ? id : null;
    resumen.value = null;
    tab.value = 'resumen';
    if (pacienteId.value && puede(PERMISOS.VER)) recargar();
  },
  { immediate: true }
);

function elegir(id) {
  router.push({ query: { paciente: id } });
}

function cambiarPaciente() {
  router.push({ query: {} });
}

async function recargar() {
  const id = pacienteId.value;
  cargando.value = true;
  error.value = '';
  try {
    const [r, l, ...registros] = await Promise.all([
      historiaApi.resumen(id),
      historiaApi.lineaDeTiempo(id),
      ...Object.keys(CONFIG).map((e) => historiaApi.listar(id, e)),
    ]);
    if (id !== pacienteId.value) return; // se cambio de paciente mientras cargaba
    resumen.value = r;
    linea.value = l;
    Object.keys(CONFIG).forEach((e, i) => (listas[e] = registros[i]));
  } catch (e) {
    error.value = e.message;
  } finally {
    cargando.value = false;
  }
}
</script>
