<script setup>
import { ref, computed, watch } from 'vue';
import SelectorPaciente from '../components/selectorPacientes.vue';
import SignosVitalesPanel from '../components/signosVitalesPanel.vue';
import MedicacionPanel from '../components/medicacionPanel.vue';
import NotasPanel from '../components/notasPanel.vue';
import ProtocolosPanel from '../components/protocolosPanel.vue';
import AvisosClinicos from '../components/avisosClinicos.vue';
import { avisos } from '../services/avisos.js';

const paciente = ref(null);
const pacienteId = computed(() => paciente.value?.id ?? null);

const tabs = [
  { id: 'signos', titulo: 'Signos vitales' },
  { id: 'medicacion', titulo: 'Medicación' },
  { id: 'notas', titulo: 'Notas' },
  { id: 'protocolos', titulo: 'Protocolos' },
];
const tabActiva = ref('signos');
const enHorario = ref(0);

watch(paciente, () => { tabActiva.value = 'signos'; enHorario.value = 0; });
</script>

<template>
  <section class="pagina pila">
    <h2>Atención y enfermería</h2>

    <AvisosClinicos />

    <SelectorPaciente v-model="paciente" />

    <template v-if="paciente">
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
    </template>

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