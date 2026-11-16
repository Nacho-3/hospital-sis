const assert = require('node:assert/strict');
const test = require('node:test');
const administracionesRepo = require('../repositorio/administracionesRepo');
const administracionesService = require('../servicio/administracionesService');
const indicacionService = require('../servicio/indicacionService');
const signosVitalesRepo = require('../repositorio/signosVitalesRepo');
const router = require('../rutas');
const autenticar = require('../../identidad/middlewares/autenticar');
const { PermisoDenegadoError } = require('../../identidad/dominio/errores');

test('lista signos vitales del paciente en orden descendente y los adapta al dominio', async () => {
  let consulta;
  const fecha = new Date('2026-11-15T12:00:00Z');
  const db = {
    async query(sql, valores) {
      consulta = { sql, valores };
      return {
        rows: [{
          id: 1,
          paciente_id: 7,
          enfermero_id: 3,
          cama_id: null,
          presion_sistolica: 120,
          presion_diastolica: 80,
          frecuencia_cardiaca: 72,
          temperatura: '36.7',
          fuera_de_rango: false,
          registrado_en: fecha,
        }],
      };
    },
  };

  const resultado = await signosVitalesRepo.listarPorPaciente(db, 7);

  assert.match(consulta.sql, /WHERE paciente_id = \$1 ORDER BY registrado_en DESC LIMIT \$2/);
  assert.deepEqual(consulta.valores, [7, 50]);
  assert.deepEqual(resultado, [{
    id: 1,
    pacienteId: 7,
    enfermeroId: 3,
    camaId: null,
    presionSistolica: 120,
    presionDiastolica: 80,
    frecuenciaCardiaca: 72,
    temperatura: 36.7,
    fueraDeRango: false,
    registradoEn: fecha,
  }]);
});

test('lista dosis pendientes con el nombre del insumo', async () => {
  let consulta;
  const esperadas = [{ id: 8, insumo_nombre: 'Paracetamol 500mg' }];
  const db = {
    async query(sql, valores) {
      consulta = { sql, valores };
      return { rows: esperadas };
    },
  };
  const hasta = new Date('2026-11-15T15:00:00Z');

  const resultado = await administracionesRepo.listarPendientes(db, { pacienteId: 12, hasta });

  assert.equal(resultado, esperadas);
  assert.match(consulta.sql, /JOIN insumos ins ON ins\.id = i\.insumo_id/);
  assert.match(consulta.sql, /ins\.nombre AS insumo_nombre/);
  assert.deepEqual(consulta.valores, [12, hasta]);
});

test('rechaza la consulta de pendientes sin un paciente válido', async () => {
  await assert.rejects(
    administracionesService.listarPendientes('no-es-un-id'),
    { code: 'PACIENTE_INVALIDO', status: 400 }
  );
});

test('rechaza prescripciones sin un paciente válido antes de acceder a la base', async () => {
  await assert.rejects(
    indicacionService.crear({ pacienteId: 0 }),
    { code: 'DATO_INVALIDO', status: 400 }
  );
});

test('protege consultas y prescripciones con autenticación y permisos en orden', () => {
  const rutas = new Map([
    ['GET /pacientes/:pacienteId/signos-vitales', 'signos_vitales:ver'],
    ['GET /pacientes/:pacienteId/notas', 'signos_vitales:ver'],
    ['POST /notas', 'signos_vitales:registrar'],
    ['GET /pacientes/:pacienteId/protocolos', 'indicacion:ver'],
    ['PATCH /protocolo-tareas/:id/realizar', 'signos_vitales:registrar'],
    ['GET /administraciones/pendientes', 'indicacion:ver'],
    ['POST /indicaciones', 'indicacion:prescribir'],
  ]);
  const configuradas = router.stack.filter((capa) => capa.route);

  for (const [clave, permiso] of rutas) {
    const [metodo, path] = clave.split(' ');
    const capa = configuradas.find((c) =>
      c.route.path === path && c.route.methods[metodo.toLowerCase()]);
    assert.ok(capa, `Falta la ruta ${clave}`);

    const middlewares = capa.route.stack.map((entrada) => entrada.handle);
    assert.equal(middlewares[0], autenticar);

    let avanzo = false;
    middlewares[1]({ usuario: { permisos: [permiso] } }, {}, () => { avanzo = true; });
    assert.equal(avanzo, true, `${clave} debe aceptar ${permiso}`);
    assert.throws(
      () => middlewares[1]({ usuario: { permisos: [] } }, {}, () => {}),
      PermisoDenegadoError
    );
  }
});
