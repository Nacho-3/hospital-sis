<template>
  <div class="pagina">
    <!-- Encabezado y buscador de paciente -->
    <div class="tarjeta" style="margin-bottom: var(--espacio-md); display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: var(--espacio-md);">
      <div>
        <h1>Facturación y Administración</h1>
        <p class="tenue">Consulta de cobertura vigente, cuenta activa y desglose de cargos por paciente.</p>
      </div>

      <form @submit.prevent="cargarDatosPaciente" style="display: flex; align-items: flex-end; gap: var(--espacio-sm);">
        <label class="campo">
          <span>ID de Paciente</span>
          <input v-model.number="pacienteId" type="number" min="1" required style="width: 120px;" />
        </label>
        <button type="submit" class="btn btn--primario" :disabled="cargando">
          {{ cargando ? 'Consultando...' : 'Consultar Cuenta' }}
        </button>
      </form>
    </div>

    <!-- Tarjetas de resumen: Cobertura y Totales -->
    <div v-if="cuenta && cobertura" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--espacio-md); margin-bottom: var(--espacio-md);">
      <div class="tarjeta">
        <p class="tenue">Cobertura Vigente</p>
        <div style="display: flex; align-items: center; gap: var(--espacio-sm); margin-top: var(--espacio-xs);">
          <h2>{{ cobertura.nombre }}</h2>
          <span class="badge" :class="claseBadgeCobertura(cobertura.tipo)">
            {{ cobertura.tipo.toUpperCase() }}
          </span>
        </div>
        <p class="tenue" style="margin-top: var(--espacio-xs);">
          <span v-if="cobertura.copago_fijo">Copago fijo por prestación: <strong>${{ formatearMonto(cobertura.copago_fijo) }}</strong></span>
          <span v-else>Sin copago fijo asignado</span>
        </p>
      </div>

      <div class="tarjeta">
        <p class="tenue">Cuenta Activa</p>
        <h2 style="margin-top: var(--espacio-xs);">Cuenta #{{ cuenta.cuentaId }}</h2>
        <p class="tenue" style="margin-top: var(--espacio-xs);">
          Paciente #{{ cuenta.pacienteId }} · {{ cuenta.cargos.length }} cargo(s) registrado(s)
        </p>
      </div>

      <div class="tarjeta">
        <p class="tenue">Total Acumulado en Cuenta</p>
        <h2 style="margin-top: var(--espacio-xs);">${{ formatearMonto(cuenta.totalAcumulado) }}</h2>
        <p class="tenue" style="margin-top: var(--espacio-xs);">
          Paciente: ${{ formatearMonto(totalPorDestinatario('paciente')) }} · Cobertura/Estado: ${{ formatearMonto(totalCobertura) }}
        </p>
      </div>
    </div>

    <!-- Tabla de cargos con pestañas de filtro -->
    <div v-if="cuenta" class="tarjeta">
      <div class="tabs">
        <button
          type="button"
          class="tab"
          :class="{ 'tab--activa': filtroDestinatario === 'todos' }"
          @click="filtroDestinatario = 'todos'"
        >
          Todos
          <span class="badge">{{ cuenta.cargos.length }}</span>
        </button>

        <button
          type="button"
          class="tab"
          :class="{ 'tab--activa': filtroDestinatario === 'paciente' }"
          @click="filtroDestinatario = 'paciente'"
        >
          Paciente
          <span class="badge badge--alerta">{{ contarPorDestinatario('paciente') }}</span>
        </button>

        <button
          type="button"
          class="tab"
          :class="{ 'tab--activa': filtroDestinatario === 'obra_social' }"
          @click="filtroDestinatario = 'obra_social'"
        >
          Obra Social
          <span class="badge badge--exito">{{ contarPorDestinatario('obra_social') }}</span>
        </button>

        <button
          type="button"
          class="tab"
          :class="{ 'tab--activa': filtroDestinatario === 'estado' }"
          @click="filtroDestinatario = 'estado'"
        >
          Estado
          <span class="badge badge--exito">{{ contarPorDestinatario('estado') }}</span>
        </button>
      </div>

      <table class="tabla">
        <thead>
          <tr>
            <th>Fecha y Hora</th>
            <th>Concepto</th>
            <th>Destinatario</th>
            <th>Responsable de Pago</th>
            <th>Origen</th>
            <th class="num">Monto</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="cargo in cargosFiltrados" :key="cargo.id">
            <td class="tenue">{{ formatearFecha(cargo.creado_en) }}</td>
            <td><strong>{{ cargo.concepto }}</strong></td>
            <td>
              <span class="badge" :class="claseBadgeDestinatario(cargo.destinatario)">
                {{ formatearDestinatario(cargo.destinatario) }}
              </span>
            </td>
            <td>{{ cargo.destinatario_nombre }}</td>
            <td class="tenue">{{ cargo.evento_origen || 'Manual' }}</td>
            <td class="num"><strong>${{ formatearMonto(cargo.monto) }}</strong></td>
          </tr>
          <tr v-if="cargosFiltrados.length === 0">
            <td colspan="6" class="tenue" style="text-align: center; padding: var(--espacio-lg);">
              No hay cargos registrados para este filtro en la cuenta activa.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Sistema de avisos flotantes del diseño global -->
    <div class="avisos">
      <transition-group name="aviso">
        <div
          v-for="item in avisos"
          :key="item.id"
          class="aviso"
          :class="{
            'aviso--error': item.tipo === 'error',
            'aviso--alerta': item.tipo === 'alerta',
          }"
        >
          {{ item.texto }}
        </div>
      </transition-group>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { facturacionService } from '../services/facturacionService';

const pacienteId = ref(1);
const cuenta = ref(null);
const cobertura = ref(null);
const cargando = ref(false);
const filtroDestinatario = ref('todos');
const avisos = ref([]);

const mostrarAviso = (texto, tipo = 'exito') => {
  const id = Date.now() + Math.random();
  avisos.value.push({ id, texto, tipo });
  setTimeout(() => {
    avisos.value = avisos.value.filter((a) => a.id !== id);
  }, 3500);
};

const cargosFiltrados = computed(() => {
  if (!cuenta.value || !cuenta.value.cargos) return [];
  if (filtroDestinatario.value === 'todos') return cuenta.value.cargos;
  return cuenta.value.cargos.filter((c) => c.destinatario === filtroDestinatario.value);
});

const contarPorDestinatario = (tipo) => {
  if (!cuenta.value || !cuenta.value.cargos) return 0;
  return cuenta.value.cargos.filter((c) => c.destinatario === tipo).length;
};

const totalPorDestinatario = (tipo) => {
  if (!cuenta.value || !cuenta.value.cargos) return 0;
  return cuenta.value.cargos
    .filter((c) => c.destinatario === tipo)
    .reduce((acc, c) => acc + Number(c.monto || 0), 0);
};

const totalCobertura = computed(() => {
  return totalPorDestinatario('obra_social') + totalPorDestinatario('estado');
});

const formatearMonto = (valor) => {
  return Number(valor || 0).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatearFecha = (fechaIso) => {
  if (!fechaIso) return '-';
  return new Date(fechaIso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatearDestinatario = (dest) => {
  const mapa = {
    paciente: 'PACIENTE',
    obra_social: 'OBRA SOCIAL',
    estado: 'ESTADO',
  };
  return mapa[dest] || dest;
};

const claseBadgeCobertura = (tipo) => {
  if (tipo === 'publica' || tipo === 'prepaga') return 'badge--exito';
  return 'badge--alerta';
};

const claseBadgeDestinatario = (dest) => {
  if (dest === 'obra_social' || dest === 'estado') return 'badge--exito';
  return 'badge--alerta';
};

const cargarDatosPaciente = async () => {
  if (!pacienteId.value || pacienteId.value < 1) {
    mostrarAviso('Ingresá un ID de paciente válido.', 'alerta');
    return;
  }

  cargando.value = true;
  try {
    const [dataCuenta, dataCobertura] = await Promise.all([
      facturacionService.obtenerCuenta(pacienteId.value),
      facturacionService.obtenerCobertura(pacienteId.value),
    ]);

    cuenta.value = dataCuenta;
    cobertura.value = dataCobertura.cobertura;
  } catch (error) {
    console.error('Error al cargar datos de facturación:', error);
    mostrarAviso('No se pudo conectar con el servidor de facturación.', 'error');
  } finally {
    cargando.value = false;
  }
};

onMounted(() => {
  cargarDatosPaciente();
});
</script>