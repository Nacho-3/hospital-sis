// Permisos de Admision (matriz de permisos, seccion 01). Los codigos y los
// roles que los tienen ya estan cargados en 10-identidad.sql.
const { autenticar, requierePermiso } = require('../../identidad');
const { PermisoDenegadoError } = require('../../identidad/dominio/errores');

const PERMISOS = {
  REGISTRAR_PACIENTE: 'paciente:registrar',   // Recepcionista
  VER_AGENDA: 'agenda:ver',                   // Recepcionista, Coordinador, Medico
  RESERVAR: 'turno:reservar',                 // Recepcionista
  CANCELAR: 'turno:cancelar',                 // Recepcionista
  CAMBIAR_ESTADO: 'turno:cambiar_estado',     // Recepcionista
  ENTRETURNO: 'turno:insertar_entreturno',    // Coordinador de agendas
  ESPERA: 'espera:agregar',                   // Recepcionista
  REGISTRAR_TRIAJE: 'triaje:registrar',       // Enfermero
  VER_TRIAJE: 'triaje:ver',                   // Medico, Enfermero
};

// Usuario autenticado con el permiso indicado.
const con = (permiso) => [autenticar, requierePermiso(permiso)];

// Usuario autenticado con al menos uno de los permisos. Sirve para las
// lecturas que comparten varias pantallas (por ejemplo, la lista de pacientes
// la usan la recepcion, la agenda y la guardia).
const conAlguno = (...permisos) => [
  autenticar,
  (req, res, next) => {
    const propios = req.usuario?.permisos || [];
    if (permisos.some((p) => propios.includes(p))) return next();
    return next(new PermisoDenegadoError());
  },
];

module.exports = { PERMISOS, con, conAlguno };
