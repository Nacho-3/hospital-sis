<template>
  <div class="pila">
    <form v-if="puedeRegistrar" class="tarjeta hc-form" @submit.prevent="guardar">
      <h3>{{ config.tituloForm }}</h3>
      <div class="hc-form__campos">
        <label
          v-for="c in camposVisibles"
          :key="c.campo"
          :class="['campo', { 'hc-form__ancho': c.tipo === 'area' }]"
        >
          <span>{{ c.etiqueta }}<template v-if="!c.opcional"> *</template></span>
          <select v-if="c.tipo === 'select'" v-model="form[c.campo]">
            <option v-for="o in c.opciones" :key="o.valor" :value="o.valor">{{ o.texto }}</option>
          </select>
          <textarea v-else-if="c.tipo === 'area'" v-model="form[c.campo]" rows="4" />
          <input v-else-if="c.tipo === 'fecha'" v-model="form[c.campo]" type="date" :max="hoy" />
          <input v-else v-model="form[c.campo]" :type="c.tipo === 'url' ? 'url' : 'text'" />
        </label>
      </div>
      <div class="hc-form__acciones">
        <span v-if="error" class="hc-error">{{ error }}</span>
        <button class="btn btn--primario" :disabled="guardando">{{ guardando ? 'Guardando…' : 'Registrar' }}</button>
      </div>
    </form>

    <div class="tarjeta">
      <p v-if="!registros.length" class="tenue">{{ config.vacio }}</p>
      <ul class="hc-registros">
        <li
          v-for="r in registros"
          :key="r.id"
          :class="['hc-registro', { 'hc-registro--rectificado': r.rectificacion_id }]"
        >
          <div class="hc-registro__cab">
            <strong>{{ config.titulo(r) }}</strong>
            <span v-for="b in config.badges(r)" :key="b.texto" :class="['badge', b.clase]">{{ b.texto }}</span>
            <span v-if="r.rectificacion_id" class="badge badge--alerta">Rectificado</span>
            <span class="tenue hc-registro__fecha">{{ fecha(r.registrado_en) }} · {{ nombre(r) }}</span>
          </div>
          <p v-for="(l, i) in config.detalle(r)" :key="i" class="hc-registro__texto">{{ l }}</p>
          <a v-if="r.enlace" :href="r.enlace" target="_blank" rel="noopener noreferrer">Ver estudio</a>

          <p v-if="r.rectificacion_id" class="hc-rectificacion">
            <strong>Rectificado</strong> por {{ nombre(r, 'rectificado_por') }} el {{ fecha(r.rectificado_en) }}:
            {{ r.rectificacion_motivo }}
          </p>
          <template v-else-if="puedeRectificar">
            <form v-if="rectificando === r.id" class="hc-rectificar" @submit.prevent="rectificar(r)">
              <label class="campo">
                Motivo de la rectificación *
                <input v-model="motivo" placeholder="Ej.: se cargó en el paciente equivocado" />
              </label>
              <button class="btn btn--peligro" :disabled="guardando">Rectificar</button>
              <button type="button" class="btn" @click="rectificando = null">Cancelar</button>
            </form>
            <button v-else class="btn hc-registro__accion" @click="abrirRectificacion(r.id)">Rectificar</button>
          </template>
          <p v-if="errorRect && rectificando === r.id" class="hc-error">{{ errorRect }}</p>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue';
import { historiaApi, fecha, nombre } from '../services/historiaApi';

const props = defineProps({
  pacienteId: { type: Number, required: true },
  entidad: { type: String, required: true },
  config: { type: Object, required: true },
  registros: { type: Array, required: true },
  puedeRegistrar: Boolean,
  puedeRectificar: Boolean,
});
const emit = defineEmits(['cambio']);

const hoy = new Date().toLocaleDateString('sv-SE'); // AAAA-MM-DD local
const vacio = () => Object.fromEntries(props.config.campos.map((c) => [c.campo, c.inicial ?? '']));
const form = reactive(vacio());
const camposVisibles = computed(() => props.config.campos.filter((c) => !c.soloSi || c.soloSi(form)));
const guardando = ref(false);
const error = ref('');
const rectificando = ref(null);
const motivo = ref('');
const errorRect = ref('');

async function guardar() {
  guardando.value = true;
  error.value = '';
  try {
    const datos = {};
    for (const c of camposVisibles.value) datos[c.campo] = form[c.campo] === '' ? undefined : form[c.campo];
    await historiaApi.registrar(props.pacienteId, props.entidad, datos);
    Object.assign(form, vacio());
    emit('cambio');
  } catch (e) {
    error.value = e.message;
  } finally {
    guardando.value = false;
  }
}

function abrirRectificacion(id) {
  rectificando.value = id;
  motivo.value = '';
  errorRect.value = '';
}

async function rectificar(r) {
  guardando.value = true;
  errorRect.value = '';
  try {
    await historiaApi.rectificar(props.pacienteId, props.entidad, r.id, motivo.value);
    rectificando.value = null;
    emit('cambio');
  } catch (e) {
    errorRect.value = e.message;
  } finally {
    guardando.value = false;
  }
}
</script>
