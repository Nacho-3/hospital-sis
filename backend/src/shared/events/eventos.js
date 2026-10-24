// Catalogo de eventos que cruzan modulos. Cambiar uno ya acordado requiere avisar al equipo.
// Carga minima (avisar antes de cambiarla):
// MedicacionAdministrada: { administracionId, pacienteId, insumoId, cantidad }
// PacienteDadoDeAlta:     { pacienteId, camaId }
// PacienteIngresado:      { pacienteId, tipoIngreso } // pre_quirurgico | infeccion_respiratoria
// TurnoEnSalaDeEspera:    { turnoId, pacienteId, medicoId }
// TriajeRiesgoVital:      { pacienteId, nivel: 'rojo' }
module.exports = {
  MEDICACION_ADMINISTRADA: 'MedicacionAdministrada', // Atencion -> Camas (stock) / Facturacion (cargo)
  PACIENTE_DADO_DE_ALTA: 'PacienteDadoDeAlta',       // Atencion -> Camas (cama pasa a limpieza)
  PACIENTE_INGRESADO: 'PacienteIngresado',           // Admision -> Atencion (protocolo de ingreso)
  TURNO_EN_SALA_DE_ESPERA: 'TurnoEnSalaDeEspera',    // Admision -> Atencion (paciente en mostrador)
  TRIAJE_RIESGO_VITAL: 'TriajeRiesgoVital',          // Admision -> Atencion (codigo rojo)
};
