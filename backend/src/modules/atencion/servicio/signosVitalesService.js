const { conTransaccion } = require('../../compartido/db');
const bus = require('../../compartido/eventBus');
const EVENTOS = require('../dominio/eventos');
const { evaluarSignosVitales, validarEntrada } = require('../dominio/signosVitales');
const signosRepo = require('../repositorio/signosVitalesRepo');
const notasRepo = require('../repositorio/notasRepo');

async function registrar({ pacienteId, enfermeroId, camaId, ...valores }) {
  validarEntrada(valores);
  const { fueraDeRango, camposFueraDeRango } = evaluarSignosVitales(valores);

  const registro = await conTransaccion(async (db) => {
    const sv = await signosRepo.insertar(db, { pacienteId, enfermeroId, camaId, ...valores, fueraDeRango });
    if (!fueraDeRango) {
      await notasRepo.insertar(db, {
        pacienteId, enfermeroId, signosVitalesId: sv.id,
        texto: 'Controles de signos vitales realizados con éxito.', automatica: true,
      });
    }
    return sv;
  });

  if (fueraDeRango) {
    bus.emit(EVENTOS.SIGNOS_FUERA_DE_RANGO, {
      pacienteId, camaId, signosVitalesId: registro.id, camposFueraDeRango, ocurridoEn: new Date(),
    });
  }
  return { ...registro, camposFueraDeRango };  // el front pinta en rojo si fueraDeRango
}
module.exports = { registrar };