const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

const rolesServicio = require('../servicio/roles.servicio');
const rolesRepo = require('../repositorio/roles.repositorio');
const permisosRepo = require('../repositorio/permisos.repositorio');
const {
  DatosInvalidosError,
  RolNoEncontradoError,
  OperacionNoPermitidaError,
} = require('../dominio/errores');

const CATALOGO = [
  { id: 3, codigo: 'usuario:ver', descripcion: 'Listar usuarios' },
  { id: 5, codigo: 'reportes:ver', descripcion: 'Ver reportes' },
  { id: 9, codigo: 'rol:administrar', descripcion: 'Editar permisos de roles' },
];

describe('Roles Servicio', () => {
  afterEach(() => {
    mock.reset();
  });

  describe('listarRoles()', () => {
    test('devuelve la lista del repositorio', async () => {
      const rolesMock = [{ id: 1, codigo: 'ADMINISTRADOR', nombre: 'Administrador' }];
      mock.method(rolesRepo, 'listar', async () => rolesMock);

      const resultado = await rolesServicio.listarRoles();

      assert.deepEqual(resultado, rolesMock);
      assert.equal(rolesRepo.listar.mock.callCount(), 1);
    });
  });

  describe('reemplazarPermisos()', () => {
    beforeEach(() => {
      mock.method(permisosRepo, 'listar', async () => CATALOGO);
      mock.method(rolesRepo, 'reemplazarPermisos', async () => {});
    });

    test('rechaza un id de rol inválido', async () => {
      await assert.rejects(rolesServicio.reemplazarPermisos('abc', [3]), DatosInvalidosError);
      assert.equal(rolesRepo.reemplazarPermisos.mock.callCount(), 0);
    });

    test('rechaza si permisos no es un arreglo', async () => {
      await assert.rejects(rolesServicio.reemplazarPermisos('2', 'todos'), DatosInvalidosError);
    });

    test('rechaza si algún permiso no es un id válido', async () => {
      await assert.rejects(rolesServicio.reemplazarPermisos('2', [3, 'a']), DatosInvalidosError);
      await assert.rejects(rolesServicio.reemplazarPermisos('2', [3, -1]), DatosInvalidosError);
    });

    test('lanza RolNoEncontradoError si el rol no existe', async () => {
      mock.method(rolesRepo, 'buscarPorId', async () => undefined);

      await assert.rejects(rolesServicio.reemplazarPermisos('2', [3]), RolNoEncontradoError);
      assert.equal(rolesRepo.reemplazarPermisos.mock.callCount(), 0);
    });

    test('ADMINISTRADOR no puede perder rol:administrar', async () => {
      mock.method(rolesRepo, 'buscarPorId', async () => ({ id: 1, codigo: 'ADMINISTRADOR', nombre: 'Administrador' }));

      await assert.rejects(rolesServicio.reemplazarPermisos('1', [3, 5]), OperacionNoPermitidaError);
      assert.equal(rolesRepo.reemplazarPermisos.mock.callCount(), 0);
    });

    test('ADMINISTRADOR puede guardar si conserva rol:administrar', async () => {
      mock.method(rolesRepo, 'buscarPorId', async () => ({ id: 1, codigo: 'ADMINISTRADOR', nombre: 'Administrador' }));

      const resultado = await rolesServicio.reemplazarPermisos('1', [3, 9]);

      assert.deepEqual(resultado, { rolId: 1, permisos: [3, 9] });
      assert.equal(rolesRepo.reemplazarPermisos.mock.callCount(), 1);
    });

    test('un rol común puede quedar sin rol:administrar y sin ningún permiso', async () => {
      mock.method(rolesRepo, 'buscarPorId', async () => ({ id: 2, codigo: 'MEDICO', nombre: 'Médico' }));

      const resultado = await rolesServicio.reemplazarPermisos('2', []);

      assert.deepEqual(resultado, { rolId: 2, permisos: [] });
    });

    test('quita permisos repetidos antes de guardar', async () => {
      mock.method(rolesRepo, 'buscarPorId', async () => ({ id: 2, codigo: 'MEDICO', nombre: 'Médico' }));

      await rolesServicio.reemplazarPermisos('2', [3, 3, 5]);

      const [rolId, permisosEnviados] = rolesRepo.reemplazarPermisos.mock.calls[0].arguments;
      assert.equal(rolId, 2);
      assert.deepEqual(permisosEnviados, [3, 5]);
    });
  });
});