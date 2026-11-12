<script setup>
import { reactive, ref, watch } from 'vue';
import { registrarSignosVitales, listarSignosVitales } from '../services/atencionService.js';
import { avisar } from '../services/avisos.js';
import { fechaHora } from '../services/formato.js';

const props = defineProps({ pacienteId: { type: Number, default: null } });

const ETIQUETAS = {
  temperatura: 'temperatura', frecuenciaCardiaca: 'frecuencia cardíaca',
  presionSistolica: 'presión sistólica', presionDiastolica: 'presión diastólica',
};
const vacio = () => ({ camaId: '', presionSistolica: '', presionDiastolica: '', frecuenciaCardiaca: '', temperatura: '' });
const form = reactive(vacio());
const historial = ref([]);
const enviando = ref(false);

const num = (v) => (v === '' || v == null ? null : Number(v));
const presion = (s) => (s.presionSistolica != null ? `${s.presionSistolica}/${s.presionDiastolica}` : '—');

async function cargar() {
  historial.value = props.pacienteId ? await listarSignosVitales(props.pacienteId) : [];
}
watch(() => props.pacienteId, () => cargar().catch((e) => avisar(e.message, 'error')), { immediate: true });

async function guardar() {
  enviando.value = true;
  try {
    const r = await registrarSignosVitales({
      pacienteId: props.pacienteId,
      camaId: num(form.camaId),
      presionSistolica: num(form.presionSistolica),
      presionDiastolica: num(form.presionDiastolica),
      frecuenciaCardiaca: num(form.frecuenciaCardiaca),
      temperatura: num(form.temperatura),
    });
    if (r.fueraDeRango) {
      const campos = r.camposFueraDeRango.map((c) => ETIQUETAS[c]).join(', ');
      avisar(`Guardado fuera de rango (${campos}). Alerta emitida al médico de guardia.`, 'error');
    } else {
      avisar('Signos vitales registrados.');
    }
    Object.assign(form, vacio());
    await cargar();
  } catch (e) {
    avisar(e.message, 'error');
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <div class="pila">
    <form class="tarjeta pila" @submit.prevent="guardar">
      <div class="rejilla">
        <label class="campo">Presión sistólica (mmHg)
          <input v-model="form.presionSistolica" type="number" min="0" />
        </label>
        <label class="campo">Presión diastólica (mmHg)
          <input v-model="form.presionDiastolica" type="number" min="0" />
        </label>
        <label class="campo">Frecuencia cardíaca (lpm)
          <input v-model="form.frecuenciaCardiaca" type="number" min="0" />
        </label>
        <label class="campo">Temperatura (°C)
          <input v-model="form.temperatura" type="number" step="0.1" min="0" />
        </label>
        <label class="campo">Cama (opcional)
          <input v-model="form.camaId" type="number" min="1" />
        </label>
      </div>
      <div>
        <button class="btn btn--primario" :disabled="enviando || !pacienteId">Registrar</button>
      </div>
    </form>

    <div class="tarjeta">
      <table class="tabla">
        <thead>
          <tr><th>Fecha</th><th class="num">Presión</th><th class="num">FC</th><th class="num">Temp.</th><th>Estado</th></tr>
        </thead>
        <tbody>
          <tr v-for="s in historial" :key="s.id" :class="{ 'fila--peligro': s.fueraDeRango }">
            <td>{{ fechaHora(s.registradoEn) }}</td>
            <td class="num">{{ presion(s) }}</td>
            <td class="num">{{ s.frecuenciaCardiaca ?? '—' }}</td>
            <td class="num">{{ s.temperatura ?? '—' }}</td>
            <td>
              <span v-if="s.fueraDeRango" class="badge">Fuera de rango</span>
              <span v-else class="badge badge--exito">Normal</span>
            </td>
          </tr>
          <tr v-if="!historial.length"><td colspan="5" class="tenue">Sin registros.</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>