<template>
  <section class="pagina">
    <!-- Sin sesion: login provisorio hasta que Identidad tenga su pantalla -->
    <form v-if="!sesion.usuario" class="tarjeta login" @submit.prevent="entrar">
      <strong>Iniciá sesión para ver Camas</strong>
      <label class="campo">
        Email
        <input v-model="email" type="email" autocomplete="username" required />
      </label>
      <label class="campo">
        Contraseña
        <input v-model="password" type="password" autocomplete="current-password" required />
      </label>
      <p v-if="errorLogin" class="login__error">{{ errorLogin }}</p>
      <button class="btn btn--primario" :disabled="entrando">{{ entrando ? 'Entrando…' : 'Entrar' }}</button>
    </form>

    <!-- Con sesion pero sin ningun permiso del modulo -->
    <div v-else-if="!tabs.length" class="tarjeta">
      <p>Tu usuario ({{ sesion.usuario.email }}) no tiene permisos en el módulo de Camas.</p>
      <button class="btn" @click="salir">Cambiar de usuario</button>
    </div>

    <template v-else>
      <div class="tabs" role="tablist">
        <button
          v-for="t in tabs"
          :key="t.id"
          role="tab"
          :aria-selected="tab === t.id"
          :class="['tab', { 'tab--activa': tab === t.id }]"
          @click="tab = t.id"
        >
          {{ t.nombre }}
          <span v-if="t.id === 'inventario' && alertas.length" class="badge">{{ alertas.length }}</span>
        </button>
        <span :class="['en-vivo', { 'en-vivo--on': conectado }]">
          {{ conectado ? 'En vivo' : 'Sin conexión en vivo' }}
        </span>
        <span class="usuario tenue">
          {{ sesion.usuario.email }}
          <button class="btn" @click="salir">Salir</button>
        </span>
      </div>

      <MapaCamas v-if="tab === 'mapa'" :version="version" @aviso="avisar" />
      <InventarioPanel v-else :version="versionStock" :alertas="alertas" @aviso="avisar" @limpiar-alertas="alertas = []" />
    </template>

    <transition-group name="aviso" tag="div" class="avisos">
      <div v-for="a in avisos" :key="a.id" :class="['aviso', a.tipo !== 'ok' && `aviso--${a.tipo}`]">{{ a.texto }}</div>
    </transition-group>
  </section>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import MapaCamas from '../components/MapaCamas.vue';
import InventarioPanel from '../components/InventarioPanel.vue';
import { escucharEnVivo } from '../services/camasApi';
import { sesion, puede, PERMISOS, iniciarSesion, cerrarSesion } from '../services/sesion';

// Cada pestaña se muestra solo si el usuario tiene el permiso para verla.
const tabs = computed(() =>
  [
    puede(PERMISOS.VER_MAPA) && { id: 'mapa', nombre: 'Mapa de camas' },
    puede(PERMISOS.VER_INVENTARIO) && { id: 'inventario', nombre: 'Inventario' },
  ].filter(Boolean)
);
const tab = ref('mapa');
watch(
  tabs,
  (lista) => {
    if (lista.length && !lista.some((t) => t.id === tab.value)) tab.value = lista[0].id;
  },
  { immediate: true }
);

// Cada evento en vivo sube una version y los hijos recargan.
const version = ref(0);
const versionStock = ref(0);
const conectado = ref(false);
const alertas = ref([]);
const avisos = ref([]);
let siguiente = 0;
let cerrar = null;

function avisar({ tipo = 'ok', texto }) {
  const id = ++siguiente;
  avisos.value.push({ id, tipo, texto });
  setTimeout(() => {
    avisos.value = avisos.value.filter((a) => a.id !== id);
  }, tipo === 'error' ? 6000 : 3500);
}

// El canal en vivo se abre con el token del usuario y se vuelve a abrir
// cuando cambia la sesion (login, logout o token vencido).
function conectarEnVivo() {
  if (cerrar) cerrar();
  cerrar = null;
  conectado.value = false;
  if (!sesion.token || !tabs.value.length) return;
  cerrar = escucharEnVivo(
    {
      CamaEstadoCambiado: () => version.value++,
      StockBajoDetectado: (c) => {
        versionStock.value++;
        alertas.value = [c, ...alertas.value.filter((a) => a.inventarioPisoId !== c.inventarioPisoId)];
        avisar({ tipo: 'alerta', texto: `Stock bajo: ${c.insumo} en piso ${c.piso} (quedan ${c.stockActual})` });
      },
    },
    (ok) => {
      // Al reconectar se recarga por si hubo cambios mientras estaba caido.
      if (ok && !conectado.value) version.value++;
      conectado.value = ok;
    }
  );
}
watch(() => sesion.token, conectarEnVivo, { immediate: true });
onBeforeUnmount(() => cerrar && cerrar());

// Login provisorio
const email = ref('');
const password = ref('');
const errorLogin = ref('');
const entrando = ref(false);

async function entrar() {
  entrando.value = true;
  errorLogin.value = '';
  try {
    await iniciarSesion(email.value, password.value);
    password.value = '';
  } catch (e) {
    errorLogin.value = e.message;
  } finally {
    entrando.value = false;
  }
}

function salir() {
  alertas.value = [];
  cerrarSesion();
}
</script>

<style>
.login {
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: var(--espacio-sm);
}
.login__error { color: var(--estado-ocupada); margin: 0; font-size: 0.875rem; }
.usuario { display: inline-flex; align-items: center; gap: var(--espacio-sm); margin-left: var(--espacio-md); }
</style>
