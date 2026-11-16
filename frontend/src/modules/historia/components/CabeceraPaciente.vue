<template>
  <section class="tarjeta hc-cabecera">
    <div class="hc-cabecera__fila">
      <div>
        <h2 class="hc-cabecera__nombre">{{ p.apellido }}, {{ p.nombre }}</h2>
        <p class="tenue">
          {{ p.documento ? `DNI ${p.documento}` : 'Sin documento' }}
          <template v-if="p.edad !== null"> · {{ p.edad }} años</template>
          <template v-if="p.fecha_nacimiento"> · Nació el {{ fecha(p.fecha_nacimiento, false) }}</template>
          <template v-if="p.telefono"> · Tel. {{ p.telefono }}</template>
        </p>
      </div>
      <button class="btn" @click="emit('cambiar')">Cambiar paciente</button>
    </div>

    <div v-if="resumen.alergias.length" :class="['hc-alergias', { 'hc-alergias--grave': resumen.alergiaGrave }]" role="alert">
      <strong>{{ resumen.alergiaGrave ? 'Alergia grave' : 'Alergias' }}:</strong>
      {{ resumen.alergias.map((a) => `${a.sustancia} (${a.severidad})`).join(', ') }}
    </div>
    <p v-else class="tenue">Sin alergias registradas.</p>

    <div class="hc-cabecera__datos">
      <div>
        <span class="hc-etiqueta">Internación</span>
        <span v-if="resumen.internacionActual">
          Cama {{ resumen.internacionActual.codigo }} · piso {{ resumen.internacionActual.piso }}, desde {{ fecha(resumen.internacionActual.fecha_hora_ingreso) }}
        </span>
        <span v-else class="tenue">No está internado</span>
      </div>
      <div>
        <span class="hc-etiqueta">Últimos signos vitales</span>
        <span v-if="s">
          <template v-if="s.presion_sistolica">TA {{ s.presion_sistolica }}/{{ s.presion_diastolica }} · </template>
          <template v-if="s.frecuencia_cardiaca">{{ s.frecuencia_cardiaca }} lpm · </template>
          <template v-if="s.temperatura">{{ s.temperatura }} °C · </template>
          {{ fecha(s.registrado_en) }}
          <span v-if="s.fuera_de_rango" class="badge badge--alerta">Fuera de rango</span>
        </span>
        <span v-else class="tenue">Sin registros</span>
      </div>
      <div>
        <span class="hc-etiqueta">Última evolución</span>
        <span v-if="resumen.ultimaEvolucion">
          {{ resumen.ultimaEvolucion.diagnostico || 'Evolución médica' }} · {{ fecha(resumen.ultimaEvolucion.registrado_en) }}
        </span>
        <span v-else class="tenue">Sin evoluciones</span>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { fecha } from '../services/historiaApi';

const props = defineProps({ resumen: { type: Object, required: true } });
const emit = defineEmits(['cambiar']);
const p = computed(() => props.resumen.paciente);
const s = computed(() => props.resumen.ultimosSignos);
</script>
