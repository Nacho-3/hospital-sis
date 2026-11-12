<template>
  <div class="tarjeta">
    <h2 class="cargo__titulo">Registrar cargo</h2>
    <p class="tenue">
      El backend reparte el monto según la cobertura vigente del paciente y guarda un cargo por destinatario.
    </p>

    <form class="cargo__form" @submit.prevent="enviar">
      <label class="campo">
        <span>Origen del cargo</span>
        <select v-model="origen">
          <option value="prestacion">Prestación del nomenclador</option>
          <option value="manual">Cargo manual</option>
          <option v-if="simulacion" value="medicacion">Medicación administrada (simulación)</option>
        </select>
      </label>

      <label v-if="origen === 'prestacion'" class="campo cargo__concepto">
        <span>Prestación</span>
        <select v-model="prestacionId" required>
          <option :value="null" disabled>Elegí una prestación</option>
          <option v-for="p in nomenclador" :key="p.id" :value="p.id">
            {{ p.descripcion }} · {{ formatearMonto(p.valor_base) }}
          </option>
        </select>
      </label>

      <template v-else-if="origen === 'manual'">
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
        {{ origen === 'medicacion' ? 'Publicar evento' : 'Generar cargo' }}
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
  // Prestaciones facturables con su valor base.
  nomenclador: { type: Array, default: () => [] },
  // Precios vigentes de insumos, para simular una medicacion.
  precios: { type: Array, default: () => [] },
  // Muestra la opcion de simular el evento (solo en desarrollo).
  simulacion: { type: Boolean, default: false },
  ocupado: { type: Boolean, default: false },
});
const emit = defineEmits(['facturar', 'registrar', 'simular']);

const origen = ref('prestacion');
const prestacionId = ref(null);
const manual = reactive({ concepto: '', monto: null });
const medicacion = reactive({ insumoId: null, cantidad: 1 });

function enviar() {
  if (origen.value === 'prestacion') emit('facturar', prestacionId.value);
  else if (origen.value === 'manual') emit('registrar', { ...manual });
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
