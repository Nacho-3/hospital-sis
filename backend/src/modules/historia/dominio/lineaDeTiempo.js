// Linea de tiempo del paciente: junta en una sola lista, ordenada por fecha,
// lo que registraron todos los modulos.
//
// Patron Adapter: cada fuente (una tabla de la HCE o de otro modulo) tiene su
// adaptador, que convierte una fila de esa tabla en una entrada con la misma
// forma para todas:
//   { fecha, tipo, origen, titulo, detalle, autor, rectificado, alerta }
// Sumar una fuente nueva es sumar un adaptador; la vista no cambia.

const ORIGEN = {
  HCE: 'Historia clínica',
  ATENCION: 'Atención',
  CAMAS: 'Camas',
  ADMISION: 'Admisión',
};

const ETIQUETA_PROTOCOLO = {
  pre_quirurgico: 'pre-quirúrgico',
  infeccion_respiratoria: 'infección respiratoria',
};

const ETIQUETA_TURNO = {
  programado: 'Turno programado',
  confirmado: 'Turno confirmado',
  en_sala_de_espera: 'En sala de espera',
  atendido: 'Turno atendido',
  cancelado: 'Turno cancelado',
};

const autor = (f) => (f.autor_apellido ? `${f.autor_nombre} ${f.autor_apellido}` : null);
const signo = (v, unidad) => (v === null || v === undefined ? null : `${v}${unidad}`);

const ADAPTADORES = {
  alergia: (f) => ({
    fecha: f.registrado_en,
    tipo: 'alergia',
    origen: ORIGEN.HCE,
    titulo: `Alergia a ${f.sustancia} (${f.severidad})`,
    detalle: f.reaccion,
    autor: autor(f),
    rectificado: Boolean(f.rectificacion_id),
    alerta: f.severidad === 'grave' && !f.rectificacion_id,
  }),
  antecedente: (f) => ({
    fecha: f.registrado_en,
    tipo: 'antecedente',
    origen: ORIGEN.HCE,
    titulo: `Antecedente ${f.tipo}${f.parentesco ? ` (${f.parentesco})` : ''}`,
    detalle: f.descripcion,
    autor: autor(f),
    rectificado: Boolean(f.rectificacion_id),
  }),
  evolucion: (f) => ({
    fecha: f.registrado_en,
    tipo: 'evolucion',
    origen: ORIGEN.HCE,
    titulo: f.diagnostico ? `Evolución: ${f.diagnostico}` : 'Evolución médica',
    detalle: f.texto,
    autor: autor(f),
    rectificado: Boolean(f.rectificacion_id),
  }),
  estudio: (f) => ({
    fecha: f.registrado_en,
    tipo: 'estudio',
    origen: ORIGEN.HCE,
    titulo: `Estudio de ${f.tipo}: ${f.nombre}`,
    detalle: f.resultado,
    autor: autor(f),
    rectificado: Boolean(f.rectificacion_id),
  }),
  signos: (f) => ({
    fecha: f.registrado_en,
    tipo: 'signos',
    origen: ORIGEN.ATENCION,
    titulo: f.fuera_de_rango ? 'Signos vitales fuera de rango' : 'Signos vitales',
    detalle: [
      f.presion_sistolica && f.presion_diastolica ? `TA ${f.presion_sistolica}/${f.presion_diastolica}` : null,
      signo(f.frecuencia_cardiaca, ' lpm'),
      signo(f.temperatura, ' °C'),
    ].filter(Boolean).join(' · '),
    autor: autor(f),
    alerta: Boolean(f.fuera_de_rango),
  }),
  nota: (f) => ({
    fecha: f.creado_en,
    tipo: 'nota',
    origen: ORIGEN.ATENCION,
    titulo: f.automatica ? 'Nota de enfermería (automática)' : 'Nota de enfermería',
    detalle: f.texto,
    autor: autor(f),
  }),
  indicacion: (f) => ({
    fecha: f.creado_en,
    tipo: 'indicacion',
    origen: ORIGEN.ATENCION,
    titulo: `Indicación: ${f.insumo}`,
    detalle: `${f.dosis} cada ${f.intervalo_horas} h${f.activa ? '' : ' (suspendida)'}`,
    autor: autor(f),
  }),
  administracion: (f) => ({
    fecha: f.administrada_en,
    tipo: 'administracion',
    origen: ORIGEN.ATENCION,
    titulo: `Medicación administrada: ${f.insumo}`,
    detalle: `${f.cantidad} ${f.unidad_medida}`,
    autor: autor(f),
  }),
  protocolo: (f) => ({
    fecha: f.creado_en,
    tipo: 'protocolo',
    origen: ORIGEN.ATENCION,
    titulo: `Protocolo de ingreso ${ETIQUETA_PROTOCOLO[f.tipo] || f.tipo}`,
    detalle: `${f.realizadas} de ${f.total} tareas realizadas`,
  }),
  ingreso: (f) => ({
    fecha: f.fecha_hora_ingreso,
    tipo: 'internacion',
    origen: ORIGEN.CAMAS,
    titulo: `Internación en cama ${f.codigo} (piso ${f.piso})`,
    detalle: f.motivo,
  }),
  egreso: (f) => ({
    fecha: f.fecha_hora_egreso,
    tipo: 'internacion',
    origen: ORIGEN.CAMAS,
    titulo: `Egreso de cama ${f.codigo}`,
    detalle: f.motivo_egreso,
  }),
  turno: (f) => ({
    fecha: f.inicio,
    tipo: 'turno',
    origen: ORIGEN.ADMISION,
    titulo: ETIQUETA_TURNO[f.estado] || `Turno ${f.estado}`,
    detalle: f.medico_apellido ? `Con ${f.medico_nombre} ${f.medico_apellido}` : null,
  }),
};

// fuentes: { alergia: [filas], signos: [filas], ... }
function armarLineaDeTiempo(fuentes, { limite = 300 } = {}) {
  const entradas = [];
  for (const [fuente, filas] of Object.entries(fuentes)) {
    const adaptar = ADAPTADORES[fuente];
    if (!adaptar) throw new Error(`No hay adaptador para la fuente ${fuente}`);
    for (const fila of filas || []) {
      const entrada = adaptar(fila);
      if (entrada.fecha) entradas.push({ rectificado: false, alerta: false, autor: null, ...entrada });
    }
  }
  entradas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  return entradas.slice(0, limite);
}

module.exports = { armarLineaDeTiempo, ADAPTADORES, ORIGEN };
