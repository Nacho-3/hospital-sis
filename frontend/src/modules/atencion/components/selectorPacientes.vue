<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { buscarPacientes } from '../services/atencionService.js';
import { avisar } from '../services/avisos.js';

defineProps({ modelValue: { type: Object, default: null } });
const emit = defineEmits(['update:modelValue']);

const texto = ref('');
const resultados = ref([]);
const cargando = ref(false);
const buscado = ref(false);            // ya hubo al menos una respuesta
let temporizador;
let ultimaBusqueda = 0;

async function buscar() {
  const numero = ++ultimaBusqueda;
  cargando.value = true;
  try {
    const filas = await buscarPacientes(texto.value.trim());
    if (numero !== ultimaBusqueda) return;           // respuesta vieja: se descarta
    resultados.value = filas;
  } catch (e) {
    if (numero === ultimaBusqueda) avisar(e.message, 'error');
  } finally {
    if (numero === ultimaBusqueda) { cargando.value = false; buscado.value = true; }
  }
}

watch(texto, () => {                                  // espera 300 ms después de tipear
  clearTimeout(temporizador);
  temporizador = setTimeout(buscar, 300);
});
onMounted(buscar);
onUnmounted(() => clearTimeout(temporizador));

const sinPacientes = computed(() =>
  buscado.value && !cargando.value && texto.value.trim() === '' && resultados.value.length === 0);
const sinCoincidencias = computed(() =>
  buscado.value && !cargando.value && texto.value.trim() !== '' && resultados.value.length === 0);
</script>

<template>
  <div v-if="modelValue" class="tarjeta pila">
    <div>
      <strong>{{ modelValue.apellido }}, {{ modelValue.nombre }}</strong>
      <p class="tenue">DNI {{ modelValue.dni }}</p>
    </div>
    <div><button class="btn" @click="emit('update:modelValue', null)">Cambiar paciente</button></div>
  </div>

  <div v-else class="tarjeta pila">
    <label class="campo">Paciente (nombre, apellido o DNI)
      <input v-model="texto" type="search" placeholder="Ej: Gómez o 30123456" autocomplete="off" />
    </label>

    <p v-if="sinPacientes" class="tenue">
      Todavía no hay pacientes registrados en el sistema.
      <router-link to="/admision">Registralos desde Admisión</router-link>.
    </p>
    <p v-else-if="sinCoincidencias" class="tenue">
      No se encontró ningún paciente con “{{ texto }}”. Revisá cómo está escrito o registralo en Admisión.
    </p>

    <table v-else-if="resultados.length" class="tabla">
      <thead><tr><th>Paciente</th><th>DNI</th><th></th></tr></thead>
      <tbody>
        <tr v-for="p in resultados" :key="p.id">
          <td>{{ p.apellido }}, {{ p.nombre }}</td>
          <td>{{ p.dni }}</td>
          <td class="num">
            <button class="btn btn--primario" @click="emit('update:modelValue', p)">Seleccionar</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>