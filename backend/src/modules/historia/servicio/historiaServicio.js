const pool = require('../../../shared/db/pool');
const { conTransaccion } = require('../../../shared/db/transaccion');
const repo = require('../repositorio/historiaRepositorio');
const lecturas = require('../repositorio/lecturasRepositorio');
const reglas = require('../dominio/registros');
const { armarLineaDeTiempo } = require('../dominio/lineaDeTiempo');
const {
  NoEncontradoError,
  YaRectificadoError,
  AlergiaDuplicadaError,
  DatosInvalidosError,
} = require('../dominio/errores');

const ENTIDAD_LEGIBLE = {
  alergia: 'la alergia',
  antecedente: 'el antecedente',
  evolucion: 'la evolución',
  estudio: 'el estudio',
};

async function pacienteExistente(db, pacienteId) {
  const id = reglas.enteroPositivo(pacienteId, 'pacienteId');
  const paciente = await lecturas.paciente(db, id);
  if (!paciente) throw new NoEncontradoError('el paciente', id);
  return paciente;
}

const vigente = (registro) => !registro.rectificacion_id;

function edad(fechaNacimiento, hoy = new Date()) {
  if (!fechaNacimiento) return null;
  // Una fecha 'AAAA-MM-DD' se toma como dia local (new Date('AAAA-MM-DD') la
  // tomaria en UTC y podria correrse un dia).
  const n = typeof fechaNacimiento === 'string'
    ? new Date(...fechaNacimiento.slice(0, 10).split('-').map((x, i) => Number(x) - (i === 1 ? 1 : 0)))
    : new Date(fechaNacimiento);
  let anios = hoy.getFullYear() - n.getFullYear();
  const cumplio = hoy.getMonth() > n.getMonth() || (hoy.getMonth() === n.getMonth() && hoy.getDate() >= n.getDate());
  if (!cumplio) anios -= 1;
  return anios;
}

// ---------- Consultas ----------

async function buscarPacientes(termino) {
  const t = reglas.texto(termino, 'el texto a buscar', { max: 80 });
  if (t.length < 2) throw new DatosInvalidosError('Escribí al menos 2 caracteres para buscar.');
  return lecturas.buscarPacientes(pool, t);
}

// Resumen para la cabecera de la historia: ficha, alertas y lo vigente.
async function resumen(pacienteId) {
  const paciente = await pacienteExistente(pool, pacienteId);
  const id = paciente.id;
  const [alergias, antecedentes, evoluciones, internaciones, signos] = await Promise.all([
    repo.listarAlergias(pool, id),
    repo.listarAntecedentes(pool, id),
    repo.listarEvoluciones(pool, id),
    lecturas.internaciones(pool, id),
    lecturas.signosVitales(pool, id),
  ]);
  const alergiasVigentes = alergias.filter(vigente);
  return {
    paciente: { ...paciente, edad: edad(paciente.fecha_nacimiento) },
    alergias: alergiasVigentes,
    alergiaGrave: alergiasVigentes.some((a) => a.severidad === 'grave'),
    antecedentes: antecedentes.filter(vigente),
    ultimaEvolucion: evoluciones.find(vigente) || null,
    internacionActual: internaciones.find((i) => !i.fecha_hora_egreso) || null,
    ultimosSignos: signos[0] || null,
  };
}

async function alergias(pacienteId) {
  const p = await pacienteExistente(pool, pacienteId);
  return repo.listarAlergias(pool, p.id);
}

async function antecedentes(pacienteId) {
  const p = await pacienteExistente(pool, pacienteId);
  return repo.listarAntecedentes(pool, p.id);
}

async function evoluciones(pacienteId) {
  const p = await pacienteExistente(pool, pacienteId);
  return repo.listarEvoluciones(pool, p.id);
}

async function estudios(pacienteId) {
  const p = await pacienteExistente(pool, pacienteId);
  return repo.listarEstudios(pool, p.id);
}

// Todo lo que registraron la HCE y los demas modulos, en orden cronologico.
async function lineaDeTiempo(pacienteId) {
  const p = await pacienteExistente(pool, pacienteId);
  const id = p.id;
  const [alergia, antecedente, evolucion, estudio, signos, nota, indicacion, administracion, protocolo, internacion, turno] =
    await Promise.all([
      repo.listarAlergias(pool, id),
      repo.listarAntecedentes(pool, id),
      repo.listarEvoluciones(pool, id),
      repo.listarEstudios(pool, id),
      lecturas.signosVitales(pool, id),
      lecturas.notas(pool, id),
      lecturas.indicaciones(pool, id),
      lecturas.administraciones(pool, id),
      lecturas.protocolos(pool, id),
      lecturas.internaciones(pool, id),
      lecturas.turnos(pool, id),
    ]);
  return armarLineaDeTiempo({
    alergia,
    antecedente,
    evolucion,
    estudio,
    signos,
    nota,
    indicacion,
    administracion,
    protocolo,
    ingreso: internacion,
    egreso: internacion.filter((i) => i.fecha_hora_egreso),
    turno: turno.filter((t) => t.estado !== 'disponible'),
  });
}

// ---------- Registros (solo inserciones) ----------

async function registrarAlergia(pacienteId, usuarioId, datos) {
  const alergia = reglas.nuevaAlergia(datos);
  return conTransaccion(async (db) => {
    const p = await pacienteExistente(db, pacienteId);
    // Un candado por paciente evita que dos registros simultaneos de la misma
    // sustancia pasen el control de duplicados.
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`hc_alergias:${p.id}`]);
    const existentes = (await repo.listarAlergias(db, p.id)).filter(vigente);
    const clave = reglas.claveSustancia(alergia.sustancia);
    if (existentes.some((a) => reglas.claveSustancia(a.sustancia) === clave)) {
      throw new AlergiaDuplicadaError(alergia.sustancia);
    }
    return repo.insertarAlergia(db, p.id, usuarioId, alergia);
  });
}

async function registrarAntecedente(pacienteId, usuarioId, datos) {
  const antecedente = reglas.nuevoAntecedente(datos);
  const p = await pacienteExistente(pool, pacienteId);
  return repo.insertarAntecedente(pool, p.id, usuarioId, antecedente);
}

async function registrarEvolucion(pacienteId, medicoId, datos) {
  const evolucion = reglas.nuevaEvolucion(datos);
  const p = await pacienteExistente(pool, pacienteId);
  return repo.insertarEvolucion(pool, p.id, medicoId, evolucion);
}

async function registrarEstudio(pacienteId, usuarioId, datos) {
  const estudio = reglas.nuevoEstudio(datos);
  const p = await pacienteExistente(pool, pacienteId);
  return repo.insertarEstudio(pool, p.id, usuarioId, estudio);
}

// Corregir sin borrar: el registro original queda, marcado como rectificado.
async function rectificar(pacienteId, usuarioId, datos) {
  const r = reglas.nuevaRectificacion(datos);
  try {
    return await conTransaccion(async (db) => {
      const p = await pacienteExistente(db, pacienteId);
      const registro = await repo.buscarRegistro(db, r.entidad, r.registroId);
      if (!registro || registro.paciente_id !== p.id) {
        throw new NoEncontradoError(`${ENTIDAD_LEGIBLE[r.entidad]} del paciente`, r.registroId);
      }
      return repo.insertarRectificacion(db, usuarioId, r);
    });
  } catch (err) {
    if (err.code === '23505' && err.constraint === 'hc_rectificaciones_unica') throw new YaRectificadoError();
    throw err;
  }
}

module.exports = {
  buscarPacientes,
  resumen,
  alergias,
  antecedentes,
  evoluciones,
  estudios,
  lineaDeTiempo,
  registrarAlergia,
  registrarAntecedente,
  registrarEvolucion,
  registrarEstudio,
  rectificar,
  edad,
};
