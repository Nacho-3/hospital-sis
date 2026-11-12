<script setup>
import { ref, computed } from 'vue';
import SignosVitalesPanel from '../components/SignosVitalesPanel.vue';
import MedicacionPanel from '../components/MedicacionPanel.vue';
import NotasPanel from '../components/NotasPanel.vue';
import ProtocolosPanel from '../components/ProtocolosPanel.vue';
import { avisos } from '../services/avisos.js';

const pacienteIdTexto = ref('');
const pacienteId = computed(() => {
  const n = Number(pacienteIdTexto.value);
  return Number.isInteger(n) && n > 0 ? n : null;
});

const tabs = [
  { id: 'signos', titulo: 'Signos vitales' },
  { id: 'medicacion', titulo: 'Medicación' },
  { id: 'notas', titulo: 'Notas' },
  { id: 'protocolos', titulo: 'Protocolos' },
];
const tabActiva = ref('signos');
const enHorario = ref(0);
</script>

<template>
  <section class="pagina pila">
    <h1>Atención y enfermería</h1>

    <div class="tarjeta">
      <label class="campo">Paciente (ID)
        <input v-model="pacienteIdTexto" type="number" min="1" placeholder="Ej: 12" />
      </label>
    </div>

    <div class="tabs">
      <button v-for="t in tabs" :key="t.id" class="tab"
              :class="{ 'tab--activa': tabActiva === t.id }" @click="tabActiva = t.id">
        {{ t.titulo }}
        <span v-if="t.id === 'medicacion' && enHorario > 0" class="badge badge--alerta">{{ enHorario }}</span>
      </button>
    </div>

    <SignosVitalesPanel v-show="tabActiva === 'signos'" :paciente-id="pacienteId" />
    <MedicacionPanel v-show="tabActiva === 'medicacion'" :paciente-id="pacienteId" @en-horario="enHorario = $event" />
    <NotasPanel v-show="tabActiva === 'notas'" :paciente-id="pacienteId" />
    <ProtocolosPanel v-show="tabActiva === 'protocolos'" :paciente-id="pacienteId" />

    <div class="avisos">
      <transition-group name="aviso">
        <div v-for="a in avisos" :key="a.id" class="aviso"
             :class="{ 'aviso--error': a.tipo === 'error', 'aviso--alerta': a.tipo === 'alerta' }">
          {{ a.mensaje }}
        </div>
      </transition-group>
    </div>
  </section>
</template>