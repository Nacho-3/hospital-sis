const { ProtocoloDirector } = require('../dominio/protocolos');
const CONSTRUCTORES = {
  pre_quirurgico: ProtocoloDirector.preQuirurgico,
  infeccion_respiratoria: ProtocoloDirector.infeccionRespiratoria,
};

async function generarPorIngreso({ pacienteId, tipoIngreso }) {
  const construir = CONSTRUCTORES[tipoIngreso];
  if (!construir) return null;                  // tipo sin protocolo base definido
  return conTransaccion((db) => protocoloRepo.insertarConTareas(db, pacienteId, construir()));
}
function registrarListeners() {
  bus.on(EVENTOS.PACIENTE_INGRESADO, (e) =>
    generarPorIngreso(e).catch((err) => console.error('Error generando protocolo:', err)));
}
module.exports = { generarPorIngreso, registrarListeners };