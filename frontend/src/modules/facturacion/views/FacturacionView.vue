<template>
  <section class="pagina">
    <header class="tarjeta fac__cabecera">
      <div>
        <h1>Facturación y Administración</h1>
        <p class="tenue">Cobertura vigente, cuenta activa y desglose de cargos por paciente.</p>
      </div>
      <form class="fac__buscador" @submit.prevent="consultar">
        <label class="campo">
          <span>ID de paciente</span>
          <input v-model.number="idBuscado" class="fac__id" type="number" min="1" step="1" required />
        </label>
        <button class="btn btn--primario" :disabled="cargando">
          {{ cargando ? 'Consultando…' : 'Consultar cuenta' }}
        </button>
      </form>
    </header>

    <p v-if="error" class="fac__error" role="alert">{{ error }}</p>
    <p v-else-if="!cuenta" class="tenue">Ingresá el ID de un paciente para ver su cobertura y su cuenta.</p>

    <template v-if="cuenta">
      <div class="fac__resumen">
        <PanelCobertura
          :cobertura="cobertura"
          :coberturas="coberturas"
          :ocupado="guardando"
          @cambiar="cambiarCobertura"
        />

        <div class="tarjeta">
          <p class="tenue">Cuenta activa</p>
          <h2 class="fac__dato">{{ cuenta.cuentaId ? `Cuenta #${cuenta.cuentaId}` : 'Sin cuenta abierta' }}</h2>
          <p class="tenue">
            {{ cuenta.paciente }} (paciente #{{ cuenta.pacienteId }}) · {{ cuenta.cargos.length }} cargo(s)
          </p>
          <p v-if="!cuenta.cuentaId" class="tenue">La cuenta se abre sola con el primer cargo.</p>
        </div>

        <div class="tarjeta">
          <p class="tenue">Total acumulado en cuenta</p>
          <h2 class="fac__dato">{{ formatearMonto(cuenta.totalAcumulado) }}</h2>
          <p class="tenue">
            Paciente: <strong>{{ formatearMonto(cuenta.totales.paciente) }}</strong> ·
            Obra social: <strong>{{ formatearMonto(cuenta.totales.obra_social) }}</strong> ·
            Estado: <strong>{{ formatearMonto(cuenta.totales.estado) }}</strong>
          </p>
        </div>
      </div>

      <FormularioCargo
        class="fac__bloque"
        :precios="precios"
        :simulacion="SIMULACION_DISPONIBLE"
        :ocupado="guardando"
        @registrar="registrarCargo"
        @simular="simularMedicacion"
      />

      <TablaCargos :cargos="cuenta.cargos" />
    </template>

    <transition-group name="aviso" tag="div" class="avisos">
      <div v-for="a in avisos" :key="a.id" :class="['aviso', a.tipo !== 'ok' && `aviso--${a.tipo}`]">{{ a.texto }}</div>
    </transition-group>
  </section>
</template>

<script setup>
import { ref } from 'vue';
import PanelCobertura from '../components/PanelCobertura.vue';
import FormularioCargo from '../components/FormularioCargo.vue';
import TablaCargos from '../components/TablaCargos.vue';
import { facturacionService } from '../services/facturacionService';
import { formatearMonto } from '../services/formato';

// La ruta de simulacion del backend solo existe fuera de produccion.
const SIMULACION_DISPONIBLE = import.meta.env.DEV;
// El cargo de un evento se genera aparte, un instante despues de publicarlo.
const ESPERA_EVENTO_MS = 500;

const idBuscado = ref(null);
// Datos del paciente consultado. Las acciones usan cuenta.pacienteId y no el
// campo de busqueda, que puede haber cambiado sin volver a consultar.
const cuenta = ref(null);
const cobertura = ref(null);
const coberturas = ref([]);
const precios = ref([]);

const cargando = ref(false);
const guardando = ref(false);
const error = ref('');
const avisos = ref([]);
let siguienteAviso = 0;

function avisar(texto, tipo = 'ok') {
  const id = ++siguienteAviso;
  avisos.value.push({ id, tipo, texto });
  setTimeout(() => {
    avisos.value = avisos.value.filter((a) => a.id !== id);
  }, tipo === 'error' ? 6000 : 3500);
}

async function consultar() {
  cargando.value = true;
  error.value = '';
  try {
    const [datosCuenta, datosCobertura, catalogo, preciosVigentes] = await Promise.all([
      facturacionService.obtenerCuenta(idBuscado.value),
      facturacionService.obtenerCobertura(idBuscado.value),
      facturacionService.coberturas(),
      facturacionService.preciosInsumo(),
    ]);
    cuenta.value = datosCuenta;
    cobertura.value = datosCobertura.cobertura;
    coberturas.value = catalogo;
    precios.value = preciosVigentes;
  } catch (err) {
    // Nunca se muestran datos de relleno: si la consulta falla, se ve el error.
    cuenta.value = null;
    cobertura.value = null;
    error.value = err.message;
  } finally {
    cargando.value = false;
  }
}

async function recargarCuenta() {
  cuenta.value = await facturacionService.obtenerCuenta(cuenta.value.pacienteId);
}

// Corre una accion que guarda, bloquea los botones mientras tanto y avisa si falla.
async function guardar(accion) {
  guardando.value = true;
  try {
    await accion();
  } catch (err) {
    avisar(err.message, 'error');
  } finally {
    guardando.value = false;
  }
}

function cambiarCobertura(coberturaId) {
  return guardar(async () => {
    const datos = await facturacionService.asignarCobertura(cuenta.value.pacienteId, coberturaId);
    cobertura.value = datos.cobertura;
    avisar(`Cobertura vigente: ${datos.cobertura.nombre}.`);
  });
}

function registrarCargo(cargo) {
  return guardar(async () => {
    const cargos = await facturacionService.registrarCargo(cuenta.value.pacienteId, cargo);
    await recargarCuenta();
    avisar(`Se generaron ${cargos.length} cargo(s) por ${cargo.concepto}.`);
  });
}

function simularMedicacion({ insumoId, cantidad }) {
  return guardar(async () => {
    const cargosAntes = cuenta.value.cargos.length;
    await facturacionService.simularMedicacion({ pacienteId: cuenta.value.pacienteId, insumoId, cantidad });
    await new Promise((resolver) => setTimeout(resolver, ESPERA_EVENTO_MS));
    await recargarCuenta();
    if (cuenta.value.cargos.length > cargosAntes) {
      avisar('Evento procesado: se generaron los cargos de la medicación.');
    } else {
      avisar('El evento se publicó pero todavía no hay cargos nuevos. Si no aparecen, revisá la consola del backend.', 'alerta');
    }
  });
}
</script>

<style>
.fac__cabecera {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: var(--espacio-md);
  margin-bottom: var(--espacio-md);
}
.fac__buscador { display: flex; align-items: flex-end; gap: var(--espacio-sm); }
.fac__id { width: 120px; }
.fac__error { color: var(--color-peligro); }
.fac__resumen {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--espacio-md);
  margin-bottom: var(--espacio-md);
}
.fac__dato { margin: var(--espacio-xs) 0; }
.fac__bloque { margin-bottom: var(--espacio-md); }
</style>
