// Eventos que publica el modulo de Camas por el eventBus compartido.
// Todavia no estan en shared/events/eventos.js porque ningun otro modulo los
// consume. Cuando alguien los necesite (por ejemplo Facturacion con
// CamaLiberada), se acuerdan en el grupo y se mueven al catalogo compartido.
//
// Carga de cada uno:
// CamaAsignada:        { asignacionId, camaId, codigoCama, pacienteId, fechaHoraIngreso }
// CamaLiberada:        { asignacionId, camaId, codigoCama, pacienteId, fechaHoraIngreso,
//                        fechaHoraEgreso, dias, motivoEgreso }
//                      dias = dias de internacion (minimo 1). Sirve para la
//                      Prestacion de tipo internacion de Facturacion.
// PacienteTrasladado:  { pacienteId, camaOrigenId, camaDestinoId,
//                        asignacionCerradaId, asignacionNuevaId }
// StockBajoDetectado:  { inventarioPisoId, piso, insumoId, insumo, stockActual, stockMinimo }
// CamaEstadoCambiado:  { camaId, codigoCama, estadoAnterior, estadoNuevo }
//                      Lo escucha el canal en vivo del mapa de camas.
module.exports = {
  CAMA_ASIGNADA: 'CamaAsignada',
  CAMA_LIBERADA: 'CamaLiberada',
  PACIENTE_TRASLADADO: 'PacienteTrasladado',
  STOCK_BAJO_DETECTADO: 'StockBajoDetectado',
  CAMA_ESTADO_CAMBIADO: 'CamaEstadoCambiado',
};
