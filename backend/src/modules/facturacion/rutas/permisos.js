// Permisos de Facturacion (matriz de permisos, seccion 04). Los codigos y los
// roles que los tienen ya estan cargados en 10-identidad.sql.
const { autenticar, requierePermiso } = require('../../identidad');

const PERMISOS = {
  VER_CUENTA: 'cuenta_paciente:ver',   // Analista de facturacion
  CALCULAR: 'facturacion:calcular',    // Analista de facturacion
};

// Usuario autenticado con el permiso indicado.
const con = (permiso) => [autenticar, requierePermiso(permiso)];

module.exports = { PERMISOS, con };
