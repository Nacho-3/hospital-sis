<template>
  <div class="buscador" @focusout="cerrarSiSale">
    <label class="campo">
      <span>Paciente</span>
      <input
        v-model="texto"
        type="search"
        placeholder="Nombre y apellido"
        autocomplete="off"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="abierto"
        aria-controls="buscador-resultados"
        @input="buscarConPausa"
        @keydown.down.prevent="mover(1)"
        @keydown.up.prevent="mover(-1)"
        @keydown.enter.prevent="elegir(resultados[activo])"
        @keydown.esc="abierto = false"
      />
    </label>

    <ul v-if="abierto" id="buscador-resultados" class="buscador__lista" role="listbox">
      <li
        v-for="(p, i) in resultados"
        :key="p.id"
        role="option"
        :aria-selected="i === activo"
        :class="['buscador__opcion', { 'buscador__opcion--activa': i === activo }]"
        @mousedown.prevent="elegir(p)"
        @mouseenter="activo = i"
      >
        <strong>{{ p.apellido }}, {{ p.nombre }}</strong>
        <span v-if="p.documento" class="tenue">DNI {{ p.documento }}</span>
      </li>
      <li v-if="!buscando && resultados.length === 0" class="buscador__opcion tenue">Sin resultados</li>
    </ul>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { facturacionService } from '../services/facturacionService';

const emit = defineEmits(['elegir', 'error']);

// Espera a que el usuario deje de escribir antes de consultar.
const PAUSA_MS = 300;
const MINIMO_CARACTERES = 2;

const texto = ref('');
const resultados = ref([]);
const activo = ref(0);
const abierto = ref(false);
const buscando = ref(false);
let temporizador = null;
let ultimaBusqueda = 0;

function buscarConPausa() {
  clearTimeout(temporizador);
  if (texto.value.trim().length < MINIMO_CARACTERES) {
    abierto.value = false;
    resultados.value = [];
    return;
  }
  temporizador = setTimeout(buscar, PAUSA_MS);
}

async function buscar() {
  // Si llegan respuestas fuera de orden, solo se muestra la de la ultima busqueda.
  const numero = ++ultimaBusqueda;
  buscando.value = true;
  try {
    const encontrados = await facturacionService.buscarPacientes(texto.value.trim());
    if (numero !== ultimaBusqueda) return;
    resultados.value = encontrados;
    activo.value = 0;
    abierto.value = true;
  } catch (err) {
    if (numero === ultimaBusqueda) emit('error', err.message);
  } finally {
    if (numero === ultimaBusqueda) buscando.value = false;
  }
}

function mover(paso) {
  if (!abierto.value || resultados.value.length === 0) return;
  const total = resultados.value.length;
  activo.value = (activo.value + paso + total) % total;
}

function elegir(paciente) {
  if (!paciente) return;
  texto.value = `${paciente.nombre} ${paciente.apellido}`;
  abierto.value = false;
  emit('elegir', paciente);
}

function cerrarSiSale(evento) {
  if (!evento.currentTarget.contains(evento.relatedTarget)) abierto.value = false;
}
</script>

<style>
.buscador { position: relative; width: 320px; }
.buscador .campo { width: 100%; }
.buscador__lista {
  position: absolute;
  z-index: 10;
  top: 100%;
  left: 0;
  right: 0;
  margin: var(--espacio-xs) 0 0;
  padding: var(--espacio-xs) 0;
  list-style: none;
  background: var(--color-superficie);
  border: 1px solid var(--color-borde);
  border-radius: 8px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  max-height: 320px;
  overflow-y: auto;
}
.buscador__opcion {
  display: flex;
  justify-content: space-between;
  gap: var(--espacio-sm);
  padding: var(--espacio-xs) var(--espacio-sm);
  cursor: pointer;
}
.buscador__opcion--activa { background: var(--color-suave); }
</style>
