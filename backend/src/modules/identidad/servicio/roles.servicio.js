const rolesRepo = require('../repositorio/roles.repositorio');
const permisosRepo = require('../repositorio/permisos.repositorio');
const {
  DatosInvalidosError,
  RolNoEncontradoError,
  OperacionNoPermitidaError,
} = require('../dominio/errores');
const { esIdValido, validarId } = require('../dominio/validaciones');

const rolProtegido = 'ADMINISTRADOR';
const permisoCritico = 'rol:administrar';

function listarPermisos() {
  return permisosRepo.listar();
}

function listarRoles() {
  return rolesRepo.listar();
}

async function obtenerPermisos(id) {
  const rolId = validarId(id);
  const rol = await rolesRepo.buscarPorId(rolId);
  if (!rol) throw new RolNoEncontradoError();
  const permisos = await rolesRepo.permisosDeRol(rolId);
  return { rol, permisos };
}

async function reemplazarPermisos(id, permisos) {
  const rolId = validarId(id);
  if (!Array.isArray(permisos) || !permisos.every(esIdValido)) {
    throw new DatosInvalidosError('La lista de permisos no es válida');
  }
  const permisosIds = [...new Set(permisos)];

  const rol = await rolesRepo.buscarPorId(rolId);
  if (!rol) throw new RolNoEncontradoError();

  if (rol.codigo === rolProtegido) {
    const todos = await permisosRepo.listar();
    const critico = todos.find((p) => p.codigo === permisoCritico);
    if (!critico || !permisosIds.includes(critico.id)) {
      throw new OperacionNoPermitidaError(
        `El rol ${rolProtegido} no puede perder el permiso ${permisoCritico}`
      );
    }
  }

  await rolesRepo.reemplazarPermisos(rolId, permisosIds);
  return { rolId, permisos: permisosIds };
}

module.exports = { listarPermisos, listarRoles, obtenerPermisos, reemplazarPermisos };