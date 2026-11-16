// Como se carga y se muestra cada tipo de registro propio de la HCE.
// Los nombres de campo son los que valida el backend (dominio/registros.js).

const SEVERIDAD = { leve: 'hc-badge-neutro', moderada: 'badge--alerta', grave: '' };
const TIPO_ANTECEDENTE = { familiar: 'Familiar', personal: 'Personal', quirurgico: 'Quirúrgico' };
const TIPO_ESTUDIO = { laboratorio: 'Laboratorio', imagen: 'Imagen', otro: 'Otro' };
const opciones = (mapa) => Object.entries(mapa).map(([valor, texto]) => ({ valor, texto }));

export const CONFIG = {
  alergia: {
    tituloForm: 'Registrar alergia',
    vacio: 'No hay alergias registradas.',
    campos: [
      { campo: 'sustancia', etiqueta: 'Sustancia', tipo: 'texto' },
      {
        campo: 'severidad',
        etiqueta: 'Severidad',
        tipo: 'select',
        inicial: 'moderada',
        opciones: opciones({ leve: 'Leve', moderada: 'Moderada', grave: 'Grave' }),
      },
      { campo: 'reaccion', etiqueta: 'Reacción', tipo: 'texto', opcional: true },
    ],
    titulo: (r) => r.sustancia,
    badges: (r) => [{ texto: r.severidad, clase: SEVERIDAD[r.severidad] }],
    detalle: (r) => (r.reaccion ? [`Reacción: ${r.reaccion}`] : []),
  },
  antecedente: {
    tituloForm: 'Registrar antecedente',
    vacio: 'No hay antecedentes registrados.',
    campos: [
      { campo: 'tipo', etiqueta: 'Tipo', tipo: 'select', inicial: 'personal', opciones: opciones(TIPO_ANTECEDENTE) },
      { campo: 'parentesco', etiqueta: 'Parentesco', tipo: 'texto', opcional: true, soloSi: (f) => f.tipo === 'familiar' },
      { campo: 'descripcion', etiqueta: 'Descripción', tipo: 'area' },
    ],
    titulo: (r) => TIPO_ANTECEDENTE[r.tipo] + (r.parentesco ? ` (${r.parentesco})` : ''),
    badges: () => [],
    detalle: (r) => [r.descripcion],
  },
  evolucion: {
    tituloForm: 'Nueva evolución médica',
    vacio: 'No hay evoluciones registradas.',
    campos: [
      { campo: 'motivo', etiqueta: 'Motivo de consulta', tipo: 'texto', opcional: true },
      { campo: 'diagnostico', etiqueta: 'Diagnóstico', tipo: 'texto', opcional: true },
      { campo: 'texto', etiqueta: 'Evolución', tipo: 'area' },
    ],
    titulo: (r) => r.diagnostico || 'Evolución médica',
    badges: () => [],
    detalle: (r) => [r.motivo && `Motivo: ${r.motivo}`, r.texto].filter(Boolean),
  },
  estudio: {
    tituloForm: 'Cargar estudio',
    vacio: 'No hay estudios cargados.',
    campos: [
      { campo: 'tipo', etiqueta: 'Tipo', tipo: 'select', inicial: 'laboratorio', opciones: opciones(TIPO_ESTUDIO) },
      { campo: 'nombre', etiqueta: 'Estudio', tipo: 'texto' },
      { campo: 'realizadoEl', etiqueta: 'Fecha de realización', tipo: 'fecha' },
      { campo: 'enlace', etiqueta: 'Enlace al informe o imagen', tipo: 'url', opcional: true },
      { campo: 'resultado', etiqueta: 'Resultado / informe', tipo: 'area' },
    ],
    titulo: (r) => r.nombre,
    badges: (r) => [{ texto: TIPO_ESTUDIO[r.tipo], clase: 'hc-badge-neutro' }],
    detalle: (r) => [
      `Realizado el ${new Date(r.realizado_el).toLocaleDateString('es-AR', { timeZone: 'UTC' })}`,
      r.resultado,
    ],
  },
};
