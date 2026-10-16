// Catalogo de eventos que cruzan modulos. Cambiar uno ya acordado requiere avisar al equipo.
module.exports = {
  MEDICACION_ADMINISTRADA: 'MedicacionAdministrada', // Atencion -> Camas (stock) / Facturacion (cargo)
  PACIENTE_DADO_DE_ALTA: 'PacienteDadoDeAlta',       // Atencion -> Camas (cama pasa a limpieza)
  PACIENTE_INGRESADO: 'PacienteIngresado',           // Admision -> Atencion (protocolo de ingreso)
};
