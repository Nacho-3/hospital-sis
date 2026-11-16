const assert = require('node:assert/strict');
const test = require('node:test');
const protocoloRepo = require('../repositorio/protocoloRepo');

test('guarda el protocolo y sus tareas con sus identificadores', async () => {
  const consultas = [];
  let secuencia = 0;
  const db = {
    async query(sql, valores) {
      consultas.push({ sql, valores });
      secuencia += 1;
      if (sql.includes('INSERT INTO protocolos')) {
        return { rows: [{ id: 12, paciente_id: 7, tipo: valores[1], creado_en: new Date(0) }] };
      }
      return {
        rows: [{ id: 30 + secuencia, descripcion: valores[1], estado: 'pendiente' }],
      };
    },
  };

  const resultado = await protocoloRepo.insertarConTareas(db, 7, {
    tipo: 'pre_quirurgico',
    tareas: [{ descripcion: 'Verificar ayuno' }, { descripcion: 'Controlar signos' }],
  });

  assert.equal(consultas.length, 3);
  assert.deepEqual(resultado, {
    id: 12,
    pacienteId: 7,
    tipo: 'pre_quirurgico',
    creadoEn: new Date(0),
    tareas: [
      { id: 32, descripcion: 'Verificar ayuno', estado: 'pendiente' },
      { id: 33, descripcion: 'Controlar signos', estado: 'pendiente' },
    ],
  });
});

test('agrupa las tareas de cada protocolo y mantiene protocolos sin tareas', async () => {
  const creadoEn = new Date(0);
  const db = {
    async query() {
      return {
        rows: [
          { id: 4, tipo: 'pre_quirurgico', creado_en: creadoEn, tarea_id: 8, descripcion: 'Ayuno', estado: 'pendiente' },
          { id: 4, tipo: 'pre_quirurgico', creado_en: creadoEn, tarea_id: 9, descripcion: 'Vía', estado: 'realizada' },
          { id: 3, tipo: 'infeccion_respiratoria', creado_en: creadoEn, tarea_id: null, descripcion: null, estado: null },
        ],
      };
    },
  };

  assert.deepEqual(await protocoloRepo.listarPorPaciente(db, 7), [
    {
      id: 4,
      tipo: 'pre_quirurgico',
      creadoEn,
      tareas: [
        { id: 8, descripcion: 'Ayuno', estado: 'pendiente' },
        { id: 9, descripcion: 'Vía', estado: 'realizada' },
      ],
    },
    { id: 3, tipo: 'infeccion_respiratoria', creadoEn, tareas: [] },
  ]);
});

test('marca una tarea existente como realizada', async () => {
  let consulta;
  const tarea = { id: 9, descripcion: 'Verificar ayuno', estado: 'realizada' };
  const db = {
    async query(sql, valores) {
      consulta = { sql, valores };
      return { rows: [tarea] };
    },
  };

  assert.equal(await protocoloRepo.marcarTareaRealizada(db, 9), tarea);
  assert.match(consulta.sql, /UPDATE protocolo_tareas/);
  assert.deepEqual(consulta.valores, [9]);
});
