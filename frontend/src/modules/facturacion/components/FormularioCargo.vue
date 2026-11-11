<template>
  <div class="tarjeta">
    <h2 class="cargo__titulo">Registrar cargo</h2>
    <p class="tenue">
      El backend reparte el monto según la cobertura vigente del paciente y guarda un cargo por destinatario.
    </p>

    <form class="cargo__form" @submit.prevent="enviar">
      <label v-if="simulacion" class="campo">
        <span>Origen del cargo</span>
        <select v-model="origen">
          <option value="manual">Cargo manual</option>
          <option value="medicacion">Medicación administrada (simulación)</option>
        </select>
      </label>

      <template v-if="origen === 'manual'">
        <label class="campo cargo__concepto">
          <span>Concepto</span>
          <input v-model.trim="manual.concepto" type="text" maxlength="160" placeholder="Ej: Radiografía de tórax" required />
        </label>
        <label class="campo cargo__numero">
          <span>Monto total ($)</span>
          <input v-model.number="manual.monto" type="number" min="0.01" step="0.01" required />
        </label>
      </template>

      <template v-else>
        <label class="campo cargo__concepto">
          <span>Insumo administrado</span>
          <select v-model="medicacion.insumoId" required>
            <option :value="null" disabled>Elegí un insumo</option>
            <option v-for="p in precios" :key="p.insumo_id" :value="p.insumo_id">
              {{ p.insumo }} · {{ formatearMonto(p.precio) }}
            </option>
          </select>
        </label>
        <label class="campo cargo__numero">
          <span>Cantidad</span>
          <input v-model.number="medicacion.cantidad" type="number" min="1" step="1" required />
        </label>
      </template>

      <button class="btn btn--primario" :disabled="ocupado">
        {{ origen === 'manual' ? 'Generar cargo' : 'Publicar evento' }}
      </button>
    </form>

    <p v-if="origen === 'medicacion'" class="tenue">
      Publica el evento MedicacionAdministrada igual que lo hará Atención: Facturación genera el cargo
      con el precio vigente del insumo y Camas descuenta el stock si el paciente está internado.
    </p>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { formatearMonto } from '../services/formato';

defineProps({
  // Precios vigentes de insumos, para simular una medicacion.
  precios: { type: Array, default: () => [] },
  // Muestra la opcion de simular el evento (solo en desarrollo).
  simulacion: { type: Boolean, default: false },
  ocupado: { type: Boolean, default: false },
});
const emit = defineEmits(['registrar', 'simular']);

const origen = ref('manual');
const manual = reactive({ concepto: '', monto: null });
const medicacion = reactive({ insumoId: null, cantidad: 1 });

function enviar() {
  if (origen.value === 'manual') emit('registrar', { ...manual });
  else emit('simular', { ...medicacion });
}
</script>

<style>
.cargo__titulo { font-size: 1rem; margin-bottom: var(--espacio-xs); }
.cargo__form {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--espacio-md);
  margin: var(--espacio-md) 0 var(--espacio-sm);
}
.cargo__concepto { flex: 1; min-width: 220px; }
.cargo__numero { width: 150px; }
</style>
