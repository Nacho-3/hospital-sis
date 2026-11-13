const crypto = require('crypto');
const { conTransaccion } = require('../../compartido/db');
const bus = require('../../compartido/eventBus');
const { ErrorNegocio } = require('../../compartido/errores');
const EVENTOS = require('../dominio/eventos');
const { dentroDeVentana, siguienteProgramacion } = require('../dominio/administracion');
const admRepo = require('../repositorio/administracionesRepo');

async function confirmar({ administracionId, enfermeroId, ahora = new Date() }) {
  const evento = await conTransaccion(async (db) => {
    const adm = await admRepo.buscarParaActualizar(db, administracionId);
    if (!adm) throw new ErrorNegocio('La administración no existe', 'NO_ENCONTRADA', 404);
    if (adm.estado !== 'pendiente') throw new ErrorNegocio('La dosis ya fue administrada', 'YA_ADMINISTRADA', 409);
    if (!adm.indicacion_activa) throw new ErrorNegocio('La indicación ya no está activa', 'INDICACION_INACTIVA', 409);
    if (!dentroDeVentana(adm.programada_para, ahora, adm.margen_minutos))
      throw new ErrorNegocio(`Fuera del margen permitido (±${adm.margen_minutos} min)`, 'FUERA_DE_VENTANA', 422);

    await admRepo.marcarAdministrada(db, adm.id, enfermeroId, ahora);
    await admRepo.insertar(db, {                                  // programa la próxima dosis
      indicacionId: adm.indicacion_id,
      programadaPara: siguienteProgramacion(adm.programada_para, adm.intervalo_horas),
      cantidad: adm.cantidad,
    });
    return {
      eventoId: crypto.randomUUID(),            // Facturación lo usa como evento_origen_id
      ocurridoEn: ahora, administracionId: adm.id, pacienteId: adm.paciente_id,
      insumoId: adm.insumo_id, cantidad: adm.cantidad, enfermeroId,
    };
  });

  bus.emit(EVENTOS.MEDICACION_ADMINISTRADA, evento);   // Camas descuenta stock, Facturación cobra
  return evento;
}
module.exports = { confirmar };