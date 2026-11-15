const rolesRepo = require('../repositorio/roles.repositorio');
const permisosRepo = require('../repositorio/permisos.repositorio');
const {
  DatosInvalidosError,
  RolNoEncontradoError,
  OperacionNoPermitidaError,
} = require('../dominio/errores');
const { esIdValido, validarId, textoObligatorio } = require('../dominio/validaciones');

const formatoCodigo = /^[A-Z][A-Z0-9_]{2,39}$/;
const rolProtegido = 'ADMINISTRADOR';
const permisoCritico = 'rol:administrar';

function listarPermisos() {
  return permisosRepo.listar();
}

async function crear({ codigo, nombre } = {}) {
  const codigoLimpio = textoObligatorio(codigo, 'codigo', 40).toUpperCase();
  if (!formatoCodigo.test(codigoLimpio)) {
    throw new DatosInvalidosError(
      'El código debe tener entre 3 y 40 caracteres: letras, números y guión bajo, empezando con una letra'
    );
  }
  const nombreLimpio = textoObligatorio(nombre, 'nombre', 80);
  return rolesRepo.crear({ codigo: codigoLimpio, nombre: nombreLimpio });
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

module.exports = { listarPermisos, crear, obtenerPermisos, reemplazarPermisos };