const test = require('node:test');
const assert = require('node:assert/strict');
const r = require('../dominio/registros');
const { armarLineaDeTiempo } = require('../dominio/lineaDeTiempo');
const { edad } = require('../servicio/historiaServicio');

test('alergia: exige sustancia y una severidad valida', () => {
  assert.deepEqual(r.nuevaAlergia({ sustancia: ' Penicilina ', severidad: 'grave' }), {
    sustancia: 'Penicilina',
    reaccion: null,
    severidad: 'grave',
  });
  assert.throws(() => r.nuevaAlergia({ severidad: 'grave' }), { code: 'DATOS_INVALIDOS' });
  assert.throws(() => r.nuevaAlergia({ sustancia: 'Látex', severidad: 'mortal' }), /severidad/);
});

test('antecedente familiar necesita parentesco; los demas no lo admiten', () => {
  assert.equal(r.nuevoAntecedente({ tipo: 'familiar', descripcion: 'Diabetes tipo 2', parentesco: 'madre' }).parentesco, 'madre');
  assert.throws(() => r.nuevoAntecedente({ tipo: 'familiar', descripcion: 'Diabetes' }), /parentesco/);
  assert.throws(() => r.nuevoAntecedente({ tipo: 'personal', descripcion: 'Asma', parentesco: 'padre' }), /parentesco/);
});

test('evolucion: el texto es obligatorio', () => {
  assert.throws(() => r.nuevaEvolucion({ diagnostico: 'Neumonía' }), /texto/);
  assert.equal(r.nuevaEvolucion({ texto: 'Mejora clínica.' }).texto, 'Mejora clínica.');
});

test('estudio: fecha valida, no futura, y enlace http(s)', () => {
  const base = { tipo: 'laboratorio', nombre: 'Hemograma', resultado: 'Normal' };
  assert.equal(r.nuevoEstudio({ ...base, realizadoEl: '2026-10-01' }).realizadoEl, '2026-10-01');
  assert.throws(() => r.nuevoEstudio({ ...base, realizadoEl: '2026-02-30' }), /fecha válida/);
  assert.throws(() => r.nuevoEstudio({ ...base, realizadoEl: '2999-01-01' }), /futura/);
  assert.throws(() => r.nuevoEstudio({ ...base, realizadoEl: '2026-10-01', enlace: 'ftp://x' }), /http/);
});

test('rectificacion: entidad conocida, id y motivo', () => {
  assert.deepEqual(r.nuevaRectificacion({ entidad: 'alergia', registroId: '7', motivo: 'Paciente equivocado' }), {
    entidad: 'alergia',
    registroId: 7,
    motivo: 'Paciente equivocado',
  });
  assert.throws(() => r.nuevaRectificacion({ entidad: 'turno', registroId: 1, motivo: 'x' }), /entidad/);
  assert.throws(() => r.nuevaRectificacion({ entidad: 'alergia', registroId: 1 }), /motivo/);
});

test('claveSustancia ignora mayusculas, espacios y tildes', () => {
  assert.equal(r.claveSustancia(' PENICILÍNA '), r.claveSustancia('penicilina'));
});

test('linea de tiempo: junta fuentes de varios modulos, ordenada de la mas nueva a la mas vieja', () => {
  const linea = armarLineaDeTiempo({
    alergia: [{ registrado_en: '2026-11-01T10:00:00Z', sustancia: 'Penicilina', severidad: 'grave', reaccion: 'Anafilaxia' }],
    signos: [{ registrado_en: '2026-11-03T08:00:00Z', presion_sistolica: 150, presion_diastolica: 95, frecuencia_cardiaca: 90, temperatura: 39.5, fuera_de_rango: true }],
    ingreso: [{ fecha_hora_ingreso: '2026-11-02T12:00:00Z', codigo: '101', piso: 1, motivo: 'Neumonía' }],
    egreso: [],
  });
  assert.deepEqual(linea.map((e) => e.origen), ['Atención', 'Camas', 'Historia clínica']);
  assert.equal(linea[0].alerta, true);
  assert.match(linea[0].detalle, /TA 150\/95 · 90 lpm · 39.5 °C/);
  assert.equal(linea[2].alerta, true, 'alergia grave vigente es alerta');
});

test('linea de tiempo: una alergia rectificada no es alerta', () => {
  const [e] = armarLineaDeTiempo({
    alergia: [{ registrado_en: '2026-11-01T10:00:00Z', sustancia: 'Látex', severidad: 'grave', rectificacion_id: 3 }],
  });
  assert.equal(e.rectificado, true);
  assert.equal(e.alerta, false);
});

test('edad: cuenta si ya cumplio en el año', () => {
  const hoy = new Date('2026-11-15T12:00:00');
  assert.equal(edad('1990-11-15', hoy), 36);
  assert.equal(edad('1990-11-16', hoy), 35);
  assert.equal(edad(null, hoy), null);
});
