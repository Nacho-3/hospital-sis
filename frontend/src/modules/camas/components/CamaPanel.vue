<template>
  <aside class="panel">
    <header class="panel__cab">
      <div>
        <div class="panel__titulo">Cama {{ cama.codigo }}</div>
        <div class="tenue">Hab. {{ cama.habitacion }} · {{ nombrePiso }}</div>
      </div>
      <button class="btn" aria-label="Cerrar" @click="emit('cerrar')">✕</button>
    </header>

    <div class="panel__estado" :style="{ '--estado': ESTADOS[cama.estado].color }">
      {{ ESTADOS[cama.estado].etiqueta }}
    </div>

    <p v-if="cama.paciente_id" class="panel__dato">
      <strong>{{ cama.paciente_apellido }}, {{ cama.paciente_nombre }}</strong><br />
      <span class="tenue">Ingresó {{ fecha(cama.fecha_hora_ingreso) }}<template v-if="cama.motivo"> · {{ cama.motivo }}</template></span>
    </p>
    <p v-if="cama.reservada_para_paciente_id" class="panel__dato">
      Reservada para <strong>{{ cama.reservada_para_apellido }}, {{ cama.reservada_para_nombre }}</strong>
    </p>

    <!-- Acciones segun el estado (las mismas que acepta el patron State del backend) -->
    <div class="panel__acciones">
      <template v-if="cama.estado === 'disponible'">
        <label class="panel__campo">
          Paciente
          <select v-model="pacienteId">
            <option value="">Elegir paciente…</option>
            <option v-for="p in pacientes" :key="p.id" :value="p.id">
              {{ p.apellido }}, {{ p.nombre }}<template v-if="p.documento"> ({{ p.documento }})</template>
            </option>
          </select>
        </label>
        <input v-model="motivo" placeholder="Motivo de internación (opcional)" />
        <p v-if="!pacientes.length" class="tenue">No hay pacientes sin cama. Los carga Admisión.</p>
        <div class="panel__fila">
          <button class="btn btn--primario" :disabled="!pacienteId || ocupado" @click="hacer('asignar')">Asignar</button>
          <button class="btn" :disabled="!pacienteId || ocupado" @click="hacer('reservar')">Reservar</button>
        </div>
        <button class="btn" :disabled="ocupado" @click="hacer('mantenimiento')">Enviar a mantenimiento</button>
      </template>

      <template v-else-if="cama.estado === 'reservada'">
        <button class="btn btn--primario" :disabled="ocupado" @click="hacer('asignarReservado')">
          Ingresar a {{ cama.reservada_para_apellido }}
        </button>
        <button class="btn" :disabled="ocupado" @click="hacer('cancelarReserva')">Cancelar reserva</button>
      </template>

      <template v-else-if="cama.estado === 'ocupada'">
        <button class="btn btn--peligro" :disabled="ocupado" @click="hacer('alta')">Dar egreso (alta)</button>
        <label class="panel__campo">
          Trasladar a
          <select v-model="destinoId">
            <option value="">Elegir cama…</option>
            <option v-for="c in destinos" :key="c.id" :value="c.id">
              {{ c.codigo }} — Hab. {{ c.habitacion }}<template v-if="c.estado === 'reservada'"> (reservada para él)</template>
            </option>
          </select>
        </label>
        <button class="btn" :disabled="!destinoId || ocupado" @click="hacer('trasladar')">Trasladar</button>
      </template>

      <template v-else-if="cama.estado === 'en_limpieza'">
        <p class="tenue">Bloqueada hasta que maestranza confirme la higiene.</p>
        <button class="btn btn--primario" :disabled="ocupado" @click="hacer('limpieza')">Confirmar limpieza</button>
        <button class="btn" :disabled="ocupado" @click="hacer('mantenimiento')">Enviar a mantenimiento</button>
      </template>

      <template v-else-if="cama.estado === 'en_mantenimiento'">
        <p class="tenue">Fuera de servicio por mantenimiento técnico.</p>
        <button class="btn btn--primario" :disabled="ocupado" @click="hacer('finMantenimiento')">Finalizar mantenimiento</button>
      </template>
    </div>

    <details class="panel__historial">
      <summary>Historial de la cama</summary>
      <p v-if="!historial.length" class="tenue">Sin internaciones registradas.</p>
      <ul>
        <li v-for="a in historial" :key="a.id">
          <strong>{{ a.paciente_apellido }}, {{ a.paciente_nombre }}</strong><br />
          <span class="tenue">
            {{ fecha(a.fecha_hora_ingreso) }} →
            {{ a.fecha_hora_egreso ? fecha(a.fecha_hora_egreso) : 'vigente' }}
            <template v-if="a.motivo_egreso"> · {{ a.motivo_egreso }}</template>
          </span>
        </li>
      </ul>
    </details>
  </aside>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { camasApi, ESTADOS } from '../services/camasApi';

const props = defineProps({
  cama: { type: Object, required: true },
  camas: { type: Array, required: true },
  version: { type: Number, default: 0 },
});
const emit = defineEmits(['cerrar', 'hecho', 'aviso']);

const pacientes = ref([]);
const pacienteId = ref('');
const motivo = ref('');
const destinoId = ref('');
const historial = ref([]);
const ocupado = ref(false);

const nombrePiso = computed(() => (Number(props.cama.piso) === 0 ? 'Planta baja' : `Piso ${props.cama.piso}`));

// Destinos de traslado: camas disponibles o reservadas para este paciente.
const destinos = computed(() =>
  props.camas.filter(
    (c) =>
      c.id !== props.cama.id &&
      (c.estado === 'disponible' ||
        (c.estado === 'reservada' && c.reservada_para_paciente_id === props.cama.paciente_id))
  )
);

async function cargarPacientes() {
  if (props.cama.estado !== 'disponible') return;
  try {
    pacientes.value = await camasApi.pacientesSinCama();
  } catch (e) {
    emit('aviso', { tipo: 'error', texto: e.message });
  }
}

async function cargarHistorial() {
  try {
    historial.value = await camasApi.historial(props.cama.id);
  } catch (e) {
    historial.value = [];
  }
}

watch(
  () => [props.cama.id, props.cama.estado, props.version],
  () => {
    pacienteId.value = '';
    motivo.value = '';
    destinoId.value = '';
    cargarPacientes();
    cargarHistorial();
  },
  { immediate: true }
);

const ACCIONES = {
  asignar: () => camasApi.asignar(props.cama.id, Number(pacienteId.value), motivo.value || undefined),
  reservar: () => camasApi.reservar(props.cama.id, Number(pacienteId.value)),
  asignarReservado: () => camasApi.asignar(props.cama.id, props.cama.reservada_para_paciente_id),
  cancelarReserva: () => camasApi.cancelarReserva(props.cama.id),
  alta: () => camasApi.liberar(props.cama.id, 'alta'),
  trasladar: () => camasApi.trasladar(props.cama.paciente_id, Number(destinoId.value)),
  limpieza: () => camasApi.finalizarLimpieza(props.cama.id),
  mantenimiento: () => camasApi.enviarAMantenimiento(props.cama.id),
  finMantenimiento: () => camasApi.finalizarMantenimiento(props.cama.id),
};

const MENSAJES = {
  asignar: 'Paciente asignado',
  reservar: 'Cama reservada',
  asignarReservado: 'Paciente ingresado',
  cancelarReserva: 'Reserva cancelada',
  alta: 'Egreso registrado: la cama pasó a limpieza',
  trasladar: 'Paciente trasladado',
  limpieza: 'Limpieza confirmada: cama disponible',
  mantenimiento: 'Cama enviada a mantenimiento',
  finMantenimiento: 'Mantenimiento finalizado',
};

async function hacer(accion) {
  ocupado.value = true;
  try {
    await ACCIONES[accion]();
    emit('hecho', MENSAJES[accion]);
  } catch (e) {
    // 409 de concurrencia: otro usuario se adelanto. Se recarga el mapa igual.
    emit('aviso', { tipo: 'error', texto: e.message });
    if (e.status === 409) emit('hecho', 'Mapa actualizado');
  } finally {
    ocupado.value = false;
  }
}

const fecha = (v) =>
  v ? new Date(v).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '';
</script>

<style>
.panel {
  width: 300px;
  flex-shrink: 0;
  position: sticky;
  top: 16px;
  border: 1px solid var(--color-borde);
  border-radius: 8px;
  padding: 16px;
  background: var(--color-superficie);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.panel__cab { display: flex; justify-content: space-between; align-items: flex-start; }
.panel__titulo { font-size: 18px; font-weight: 700; }
.panel__estado {
  align-self: flex-start;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-sobre);
  background: var(--estado);
}
.panel__dato { margin: 0; font-size: 14px; }
.panel__acciones { display: flex; flex-direction: column; gap: 8px; }
.panel__acciones p { margin: 0; }
.panel__campo { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--color-tenue); }
.panel__fila { display: flex; gap: 8px; }
.panel__fila .btn { flex: 1; }
.panel__historial { font-size: 14px; border-top: 1px solid var(--color-borde); padding-top: 10px; }
.panel__historial summary { cursor: pointer; font-weight: 600; }
.panel__historial ul { list-style: none; padding: 0; margin: 8px 0 0; display: flex; flex-direction: column; gap: 8px; }
@media (max-width: 800px) {
  .panel { width: auto; position: static; }
}
</style>
