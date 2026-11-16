<script setup>
import { onUnmounted, ref, watch } from 'vue';
import { listarProtocolos, realizarTarea } from '../services/atencionService.js';
import { avisar } from '../services/avisos.js';
import { fechaHora } from '../services/formato.js';

const props = defineProps({ pacienteId: { type: Number, default: null } });
const TITULOS = { pre_quirurgico: 'Ingreso pre-quirúrgico', infeccion_respiratoria: 'Ingreso por infección respiratoria' };
const protocolos = ref([]);

const realizadas = (p) => p.tareas.filter((t) => t.estado === 'realizada').length;
const completo = (p) => realizadas(p) === p.tareas.length;
let reloj;

async function cargar() {
  protocolos.value = props.pacienteId ? await listarProtocolos(props.pacienteId) : [];
}
watch(() => props.pacienteId, () => {
  clearInterval(reloj);
  cargar().catch((e) => avisar(e.message, 'error'));
  if (props.pacienteId) reloj = setInterval(() => cargar().catch(() => {}), 4000);
}, { immediate: true });
onUnmounted(() => clearInterval(reloj));

async function marcar(tarea) {
  try { await realizarTarea(tarea.id); await cargar(); }
  catch (e) { avisar(e.message, 'error'); }
}
</script>

<template>
  <div class="pila">
    <div v-for="p in protocolos" :key="p.id" class="tarjeta pila">
      <div>
        <strong>{{ TITULOS[p.tipo] ?? p.tipo }}</strong>
        <span class="tenue"> · {{ fechaHora(p.creadoEn) }} </span>
        <span class="badge" :class="completo(p) ? 'badge--exito' : 'badge--alerta'">
          {{ realizadas(p) }}/{{ p.tareas.length }}
        </span>
      </div>
      <table class="tabla">
        <tbody>
          <tr v-for="t in p.tareas" :key="t.id">
            <td>{{ t.descripcion }}</td>
            <td>
              <span v-if="t.estado === 'realizada'" class="badge badge--exito">Realizada</span>
              <span v-else class="badge badge--alerta">Pendiente</span>
            </td>
            <td class="num">
              <button v-if="t.estado !== 'realizada'" class="btn" @click="marcar(t)">Marcar realizada</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="!protocolos.length" class="tenue">Sin protocolos para este paciente.</p>
  </div>
</template>