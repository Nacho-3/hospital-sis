<script setup>
import { ref, reactive, watch } from 'vue';
import { listarMedicamentos, crearIndicacion } from '../services/atencionService.js';
import { avisar } from '../services/avisos.js';

const props = defineProps({ pacienteId: { type: Number, default: null } });
const emit = defineEmits(['creada']);

const piso = ref(null);
const medicamentos = ref([]);
const enviando = ref(false);

// Fecha y hora local para el input datetime-local (AAAA-MM-DDTHH:MM).
const ahoraLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

const vacio = () => ({ insumoId: '', dosis: '', cantidad: 1, intervaloHoras: 8, margenMinutos: 30, primeraDosis: ahoraLocal() });
const form = reactive(vacio());

async function cargar() {
  if (!props.pacienteId) return;
  const datos = await listarMedicamentos(props.pacienteId);
  piso.value = datos.piso;
  medicamentos.value = datos.medicamentos;
}
watch(() => props.pacienteId, () => cargar().catch((e) => avisar(e.message, 'error')), { immediate: true });

const etiqueta = (m) =>
  piso.value === null || m.stock === null
    ? m.nombre
    : `${m.nombre} · stock en el piso ${piso.value}: ${m.stock}`;

async function recetar() {
  enviando.value = true;
  try {
    await crearIndicacion({
      pacienteId: props.pacienteId,
      insumoId: Number(form.insumoId),
      dosis: form.dosis,
      cantidad: Number(form.cantidad),
      intervaloHoras: Number(form.intervaloHoras),
      margenMinutos: Number(form.margenMinutos),
      primeraDosis: new Date(form.primeraDosis).toISOString(),
    });
    avisar('Medicación recetada. La primera dosis ya figura en la lista.');
    Object.assign(form, vacio());
    emit('creada');
  } catch (e) {
    avisar(e.message, 'error');
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <form class="tarjeta pila" @submit.prevent="recetar">
    <h3>Recetar medicación</h3>
    <p v-if="piso === null" class="aviso aviso--alerta">
      El paciente no está internado: las dosis se registran, pero no se descuenta stock de ningún piso.
    </p>
    <div class="rejilla">
      <label class="campo">Medicamento
        <select v-model="form.insumoId" required>
          <option value="" disabled>Elegí uno</option>
          <option v-for="m in medicamentos" :key="m.id" :value="m.id">{{ etiqueta(m) }}</option>
        </select>
      </label>
      <label class="campo">Dosis (indicación)
        <input v-model="form.dosis" maxlength="80" placeholder="Ej.: 400 mg por vía oral" required />
      </label>
      <label class="campo">Unidades por dosis
        <input v-model="form.cantidad" type="number" min="1" required />
      </label>
      <label class="campo">Cada (horas)
        <input v-model="form.intervaloHoras" type="number" min="1" required />
      </label>
      <label class="campo">Margen (minutos)
        <input v-model="form.margenMinutos" type="number" min="0" required />
      </label>
      <label class="campo">Primera dosis
        <input v-model="form.primeraDosis" type="datetime-local" required />
      </label>
    </div>
    <div>
      <button class="btn btn--primario" :disabled="enviando || !pacienteId">Recetar</button>
    </div>
  </form>
</template>
