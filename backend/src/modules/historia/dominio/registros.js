const { DatosInvalidosError } = require('./errores');

// Validacion de los registros clinicos. Es dominio puro: no conoce ni la base
// ni Express, asi que se prueba sin levantar nada (tests/registros.test.js).

const SEVERIDADES = ['leve', 'moderada', 'grave'];
const TIPOS_ANTECEDENTE = ['familiar', 'personal', 'quirurgico'];
const TIPOS_ESTUDIO = ['laboratorio', 'imagen', 'otro'];
const ENTIDADES = ['alergia', 'antecedente', 'evolucion', 'estudio'];

function enteroPositivo(valor, campo) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0 || n > 2147483647) {
    throw new DatosInvalidosError(`${campo} tiene que ser un entero positivo.`);
  }
  return n;
}

function texto(valor, campo, { max, opcional = false } = {}) {
  if (valor === undefined || valor === null || String(valor).trim() === '') {
    if (opcional) return null;
    throw new DatosInvalidosError(`Falta ${campo}.`);
  }
  const limpio = String(valor).trim();
  if (limpio.length > max) {
    throw new DatosInvalidosError(`${campo} admite hasta ${max} caracteres.`);
  }
  return limpio;
}

function unoDe(valor, campo, opciones) {
  if (!opciones.includes(valor)) {
    throw new DatosInvalidosError(`${campo} tiene que ser uno de: ${opciones.join(', ')}.`);
  }
  return valor;
}

function fechaNoFutura(valor, campo) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw new DatosInvalidosError(`${campo} tiene que tener el formato AAAA-MM-DD.`);
  }
  const fecha = new Date(`${valor}T00:00:00Z`);
  if (Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== valor) {
    throw new DatosInvalidosError(`${campo} no es una fecha válida.`);
  }
  const hoy = new Date().toISOString().slice(0, 10);
  if (valor > hoy) throw new DatosInvalidosError(`${campo} no puede ser una fecha futura.`);
  return valor;
}

function enlaceOpcional(valor) {
  const limpio = texto(valor, 'enlace', { max: 500, opcional: true });
  if (limpio && !/^https?:\/\//i.test(limpio)) {
    throw new DatosInvalidosError('El enlace tiene que empezar con http:// o https://.');
  }
  return limpio;
}

function nuevaAlergia(datos = {}) {
  return {
    sustancia: texto(datos.sustancia, 'sustancia', { max: 120 }),
    reaccion: texto(datos.reaccion, 'reacción', { max: 240, opcional: true }),
    severidad: unoDe(datos.severidad, 'severidad', SEVERIDADES),
  };
}

function nuevoAntecedente(datos = {}) {
  const tipo = unoDe(datos.tipo, 'tipo', TIPOS_ANTECEDENTE);
  const parentesco = texto(datos.parentesco, 'parentesco', { max: 40, opcional: true });
  if (tipo === 'familiar' && !parentesco) {
    throw new DatosInvalidosError('Un antecedente familiar necesita el parentesco (madre, padre…).');
  }
  if (tipo !== 'familiar' && parentesco) {
    throw new DatosInvalidosError('El parentesco solo corresponde a antecedentes familiares.');
  }
  return { tipo, descripcion: texto(datos.descripcion, 'descripción', { max: 2000 }), parentesco };
}

function nuevaEvolucion(datos = {}) {
  return {
    motivo: texto(datos.motivo, 'motivo', { max: 160, opcional: true }),
    diagnostico: texto(datos.diagnostico, 'diagnóstico', { max: 240, opcional: true }),
    texto: texto(datos.texto, 'texto de la evolución', { max: 5000 }),
  };
}

function nuevoEstudio(datos = {}) {
  return {
    tipo: unoDe(datos.tipo, 'tipo', TIPOS_ESTUDIO),
    nombre: texto(datos.nombre, 'nombre del estudio', { max: 160 }),
    realizadoEl: fechaNoFutura(datos.realizadoEl, 'fecha de realización'),
    resultado: texto(datos.resultado, 'resultado', { max: 5000 }),
    enlace: enlaceOpcional(datos.enlace),
  };
}

function nuevaRectificacion(datos = {}) {
  return {
    entidad: unoDe(datos.entidad, 'entidad', ENTIDADES),
    registroId: enteroPositivo(datos.registroId, 'registroId'),
    motivo: texto(datos.motivo, 'motivo de la rectificación', { max: 1000 }),
  };
}

// Normaliza el nombre de una sustancia para comparar duplicados
// ("Penicilina", " penicilina " y "PENICILINA" son la misma).
const claveSustancia = (s) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

module.exports = {
  SEVERIDADES,
  TIPOS_ANTECEDENTE,
  TIPOS_ESTUDIO,
  ENTIDADES,
  enteroPositivo,
  texto,
  nuevaAlergia,
  nuevoAntecedente,
  nuevaEvolucion,
  nuevoEstudio,
  nuevaRectificacion,
  claveSustancia,
};
