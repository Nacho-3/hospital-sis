<template>
  <section class="pagina">
    <h2>Reserva de turno</h2>
    <p class="tenue">La recepcionista confirma un turno libre. Pasa a Programado y nadie más puede tomarlo. El coordinador puede partir uno de 30 minutos en dos de 15. Si se cancela un turno, el primero de la lista de espera se queda con ese horario.</p>

    <div class="reserva">
      <form class="tarjeta" @submit.prevent="crearPaciente">
        <strong>Registrar paciente</strong>
        <p class="tenue">La historia pide que el paciente ya esté en el sistema. Carlos López, por ejemplo.</p>
        <label class="campo">Nombre
          <input v-model="paciente.nombre" required />
        </label>
        <label class="campo">Apellido
          <input v-model="paciente.apellido" required />
        </label>
        <label class="campo">Documento
          <input v-model="paciente.documento" />
        </label>
        <button class="btn btn--primario" :disabled="guardando">Registrar</button>
      </form>

      <form class="tarjeta" @submit.prevent="crearTurno">
        <strong>Abrir un turno libre</strong>
        <p class="tenue">Todavía no tiene paciente. En la historia, el de las 10:00 con el Dr. Silva.</p>
        <label class="campo">Médico
          <select v-model="turno.medicoId" required>
            <option value="">Elegir médico…</option>
            <option v-for="m in medicos" :key="m.id" :value="m.id">{{ m.apellido }}, {{ m.nombre }}</option>
          </select>
        </label>
        <label class="campo">Empieza
          <input v-model="turno.inicio" type="datetime-local" required />
        </label>
        <label class="campo">Termina
          <input v-model="turno.fin" type="datetime-local" required />
        </label>
        <button class="btn btn--primario" :disabled="guardando || !medicos.length">Abrir turno</button>
      </form>
    </div>

    <div class="tarjeta reserva__elegir">
      <label class="campo">Paciente que toma el turno
        <select v-model="pacienteId">
          <option value="">Elegir paciente…</option>
          <option v-for="p in pacientes" :key="p.id" :value="p.id">
            {{ p.apellido }}, {{ p.nombre }}<template v-if="p.documento"> ({{ p.documento }})</template>
          </option>
        </select>
      </label>
    </div>

    <table class="tabla">
      <thead>
        <tr>
          <th>Horario</th>
          <th>Médico</th>
          <th>Estado</th>
          <th>Paciente</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="t in turnos" :key="t.id">
          <td>
            {{ horario(t) }}
            <span v-if="t.duracion_reducida" class="badge badge--alerta">Menos tiempo</span>
            <span v-if="t.es_entreturno" class="badge badge--alerta">Entreturno</span>
          </td>
          <td>{{ t.medico_apellido }}, {{ t.medico_nombre }}</td>
          <td><span :class="['estado', `estado--${t.estado}`]">{{ etiqueta(t.estado) }}</span></td>
          <td>
            <template v-if="t.paciente_id">{{ t.paciente_apellido }}, {{ t.paciente_nombre }}</template>
            <span v-else class="tenue">Sin paciente</span>
          </td>
          <td>
            <button
              v-if="t.estado === 'disponible'"
              class="btn btn--primario"
              :disabled="!pacienteId || guardando"
              @click="reservar(t)"
            >
              Reservar
            </button>
            <button
              v-if="puedePartir(t)"
              class="btn"
              :disabled="guardando"
              @click="entreturno(t)"
            >
              Entreturno
            </button>
            <button
              v-if="puedeCancelar(t)"
              class="btn btn--peligro"
              :disabled="guardando"
              @click="cancelar(t)"
            >
              Cancelar
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="!turnos.length" class="tenue">No hay turnos. Abrí uno libre para poder reservarlo.</p>

    <div v-if="llamado" class="aviso aviso--alerta llamado">{{ llamado }}</div>

    <form class="tarjeta reserva__elegir" @submit.prevent="anotarEspera">
      <strong>Lista de espera</strong>
      <p class="tenue">Sin turno todavía. Si se cancela uno de ese médico en ese día, se llama al primero.</p>
      <div class="espera">
        <label class="campo">Médico
          <select v-model="espera.medicoId" required>
            <option value="">Elegir médico…</option>
            <option v-for="m in medicos" :key="m.id" :value="m.id">{{ m.apellido }}, {{ m.nombre }}</option>
          </select>
        </label>
        <label class="campo">Día
          <input v-model="espera.fecha" type="date" required />
        </label>
        <button class="btn btn--primario" :disabled="guardando || !pacienteId">Anotar en la lista</button>
      </div>
      <p v-if="!pacienteId" class="tenue">Elegí arriba el paciente que queda en espera.</p>
    </form>

    <table class="tabla">
      <thead>
        <tr>
          <th>Posición</th>
          <th>Día</th>
          <th>Médico</th>
          <th>Paciente</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="e in esperaFilas" :key="e.id">
          <td>{{ e.posicion }}</td>
          <td>{{ diaLista(e.fecha) }}</td>
          <td>{{ e.medico_apellido }}, {{ e.medico_nombre }}</td>
          <td>{{ e.paciente_apellido }}, {{ e.paciente_nombre }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="!esperaFilas.length" class="tenue">Nadie está en la lista de espera.</p>

    <div class="avisos">
      <div v-for="a in avisos" :key="a.id" :class="['aviso', a.tipo !== 'ok' && `aviso--${a.tipo}`]">{{ a.texto }}</div>
    </div>
  </section>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { admisionApi } from '../services/admisionApi';

const pacientes = ref([]);
const medicos = ref([]);
const turnos = ref([]);
const esperaFilas = ref([]);
const pacienteId = ref('');
const guardando = ref(false);
const avisos = ref([]);
const llamado = ref('');
let siguiente = 0;

const paciente = reactive({ nombre: '', apellido: '', documento: '' });
const turno = reactive({ medicoId: '', inicio: '', fin: '' });
const espera = reactive({ medicoId: '', fecha: '' });

const ETIQUETAS = {
  disponible: 'Disponible',
  programado: 'Programado',
  confirmado: 'Confirmado',
  en_sala_de_espera: 'En sala de espera',
  atendido: 'Atendido',
  cancelado: 'Cancelado',
};

function etiqueta(estado) {
  return ETIQUETAS[estado] || estado;
}

function duraMediaHora(t) {
  return new Date(t.fin) - new Date(t.inicio) === 30 * 60 * 1000;
}

function puedePartir(t) {
  return (t.estado === 'disponible' || t.estado === 'programado') && duraMediaHora(t);
}

function puedeCancelar(t) {
  return t.estado === 'programado' || t.estado === 'confirmado';
}

function diaLista(fecha) {
  const [anio, mes, dia] = String(fecha).slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

function horario(t) {
  const inicio = new Date(t.inicio);
  const fin = new Date(t.fin);
  const dia = inicio.toLocaleDateString('es-AR');
  const hora = (d) => d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  return `${dia} ${hora(inicio)}–${hora(fin)}`;
}

function avisar(texto, tipo = 'ok') {
  const id = ++siguiente;
  avisos.value.push({ id, tipo, texto });
  const duracion = tipo === 'ok' ? 3500 : 8000;
  setTimeout(() => {
    avisos.value = avisos.value.filter((a) => a.id !== id);
  }, duracion);
}

async function cargar() {
  const [listaPacientes, listaMedicos, listaTurnos, listaEspera] = await Promise.all([
    admisionApi.pacientes(),
    admisionApi.medicos(),
    admisionApi.turnos(),
    admisionApi.listaEspera(),
  ]);
  pacientes.value = listaPacientes;
  medicos.value = listaMedicos;
  turnos.value = listaTurnos;
  esperaFilas.value = listaEspera;
  if (!turno.medicoId && listaMedicos.length) turno.medicoId = listaMedicos[0].id;
  if (!espera.medicoId && listaMedicos.length) espera.medicoId = listaMedicos[0].id;
}

function fechaLocal(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

onMounted(async () => {
  const inicio = new Date();
  inicio.setDate(inicio.getDate() + 1);
  inicio.setHours(10, 0, 0, 0);
  const fin = new Date(inicio.getTime() + 30 * 60 * 1000);
  turno.inicio = fechaLocal(inicio);
  turno.fin = fechaLocal(fin);
  espera.fecha = fechaLocal(inicio).slice(0, 10);
  try {
    await cargar();
  } catch (e) {
    avisar(e.message, 'error');
  }
});

async function crearPaciente() {
  guardando.value = true;
  try {
    const creado = await admisionApi.registrarPaciente({ ...paciente });
    pacienteId.value = creado.id;
    Object.assign(paciente, { nombre: '', apellido: '', documento: '' });
    await cargar();
    avisar('Paciente registrado.');
  } catch (e) {
    avisar(e.message, 'error');
  } finally {
    guardando.value = false;
  }
}

async function crearTurno() {
  guardando.value = true;
  try {
    await admisionApi.abrirTurno({
      medicoId: Number(turno.medicoId),
      inicio: new Date(turno.inicio).toISOString(),
      fin: new Date(turno.fin).toISOString(),
    });
    await cargar();
    avisar('Turno libre abierto.');
  } catch (e) {
    avisar(e.message, 'error');
  } finally {
    guardando.value = false;
  }
}

async function entreturno(fila) {
  guardando.value = true;
  try {
    const resultado = await admisionApi.insertarEntreturno(fila.id);
    await cargar();
    avisar(`Quedó en 15 minutos y se abrió el entreturno de ${horario(resultado.entreturno)}.`);
  } catch (e) {
    await cargar();
    avisar(e.message, 'error');
  } finally {
    guardando.value = false;
  }
}

async function anotarEspera() {
  guardando.value = true;
  try {
    await admisionApi.anotarEnEspera({
      pacienteId: Number(pacienteId.value),
      medicoId: Number(espera.medicoId),
      fecha: espera.fecha,
    });
    await cargar();
    avisar('Paciente anotado en la lista de espera.');
  } catch (e) {
    avisar(e.message, 'error');
  } finally {
    guardando.value = false;
  }
}

async function cancelar(fila) {
  guardando.value = true;
  try {
    const resultado = await admisionApi.cancelar(fila.id);
    await cargar();
    if (resultado.asignado) {
      llamado.value = resultado.asignado.aviso;
      avisar(resultado.asignado.aviso, 'alerta');
    } else {
      llamado.value = '';
      avisar('Turno cancelado. No había nadie en la lista de espera.');
    }
  } catch (e) {
    await cargar();
    avisar(e.message, 'error');
  } finally {
    guardando.value = false;
  }
}

async function reservar(fila) {
  guardando.value = true;
  try {
    const tomado = await admisionApi.reservar(fila.id, Number(pacienteId.value));
    await cargar();
    avisar(`Turno programado para ${tomado.paciente_apellido}, ${tomado.paciente_nombre}.`);
  } catch (e) {
    await cargar();
    avisar(e.message, 'error');
  } finally {
    guardando.value = false;
  }
}
</script>

<style>
.reserva {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--espacio-lg);
  margin: var(--espacio-lg) 0;
}
.reserva .tarjeta {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-sm);
}
.reserva__elegir {
  margin-bottom: var(--espacio-md);
}
.estado {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: var(--radio-pill);
  color: var(--color-sobre);
  background: var(--color-neutro);
}
.estado--disponible { background: var(--estado-disponible); }
.estado--programado { background: var(--color-primario); }
.estado--cancelado { background: var(--color-peligro); }
.tabla .badge { margin-left: var(--espacio-xs); }
.espera {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: var(--espacio-md);
  align-items: end;
}
.llamado { margin: var(--espacio-md) 0; }
@media (max-width: 800px) {
  .reserva { grid-template-columns: 1fr; }
  .espera { grid-template-columns: 1fr; }
}
</style>
