<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { listarPendientes, confirmarAdministracion } from '../services/atencionService.js';
import { avisar } from '../services/avisos.js';
import { fechaHora } from '../services/formato.js';
import { tienePermiso } from '../../identidad/services/sesion.js';
import RecetaForm from './recetaForm.vue';

// El medico receta; enfermeria confirma cada dosis (y ahi Camas descuenta el stock).
const puedeRecetar = tienePermiso('indicacion:prescribir');
const puedeAdministrar = tienePermiso('medicacion:administrar');

const props = defineProps({ pacienteId: { type: Number, default: null } });
const emit = defineEmits(['en-horario']);

const pendientes = ref([]);
const ahora = ref(new Date());
const confirmando = ref(null);
let reloj;
onMounted(() => { reloj = setInterval(() => (ahora.value = new Date()), 30_000); });
onUnmounted(() => clearInterval(reloj));

function estadoDe(p) {
  const difMin = (ahora.value - p.programadaPara) / 60000;
  if (Math.abs(difMin) <= p.margenMinutos) return 'en-horario';
  return difMin < 0 ? 'proxima' : 'vencida';
}
const enHorario = computed(() => pendientes.value.filter((p) => estadoDe(p) === 'en-horario').length);
watch(enHorario, (n) => emit('en-horario', n), { immediate: true });

async function cargar() {
  pendientes.value = props.pacienteId ? await listarPendientes(props.pacienteId) : [];
}
watch(() => props.pacienteId, () => cargar().catch((e) => avisar(e.message, 'error')), { immediate: true });

async function confirmar(p) {
  confirmando.value = p.id;
  try {
    await confirmarAdministracion(p.id);
    avisar(`${p.insumo} administrada.`);
  } catch (e) {
    avisar(e.message, e.status === 409 ? 'alerta' : 'error');   // 409: ya administrada o indicación inactiva
  } finally {
    confirmando.value = null;
    await cargar().catch(() => {});
  }
}
</script>

<template>
  <div class="pila">
  <RecetaForm v-if="puedeRecetar" :paciente-id="pacienteId" @creada="cargar" />
  <div class="tarjeta">
    <table class="tabla">
      <thead>
        <tr><th>Hora</th><th>Medicación</th><th>Dosis</th><th>Estado</th><th></th></tr>
      </thead>
      <tbody>
        <tr v-for="p in pendientes" :key="p.id">
          <td>{{ fechaHora(p.programadaPara) }}</td>
          <td>{{ p.insumo }}</td>
          <td>{{ p.dosis }} <span class="tenue">· {{ p.cantidad }} u.</span></td>
          <td>
            <span v-if="estadoDe(p) === 'en-horario'" class="badge badge--exito">En horario</span>
            <span v-else-if="estadoDe(p) === 'vencida'" class="badge">Vencida</span>
            <span v-else class="tenue">Próxima</span>
          </td>
          <td class="num">
            <button v-if="puedeAdministrar" class="btn btn--primario"
                    :disabled="estadoDe(p) !== 'en-horario' || confirmando === p.id"
                    @click="confirmar(p)">Confirmar administración</button>
            <span v-else class="tenue">La confirma enfermería</span>
          </td>
        </tr>
        <tr v-if="!pendientes.length"><td colspan="5" class="tenue">No hay dosis pendientes.</td></tr>
      </tbody>
    </table>
  </div>
  </div>
</template>