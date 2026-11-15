const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

const usuariosServicio = require('../servicio/usuarios.servicio');
const usuariosRepo = require('../repositorio/usuarios.repositorio');
const rolesRepo = require('../repositorio/roles.repositorio');
const { DatosInvalidosError } = require('../dominio/errores');
const bcrypt = require('bcryptjs');

describe('Usuarios Servicio [Nativo]', () => {

  beforeEach(() => {
    // Inicialización si es requerida
  });

  afterEach(() => {
    mock.reset();
  });

  describe('crear()', () => {
    test('debe lanzar DatosInvalidosError si el nombre está vacío', async () => {
      const datos = {
        email: 'test@correo.com',
        nombre: '   ',
        apellido: 'Pérez',
        password: 'password123',
        roles: [1]
      };

      await assert.rejects(
        async () => await usuariosServicio.crear(datos),
        (err) => {
          assert.ok(err instanceof DatosInvalidosError);
          return true;
        }
      );
    });

    test('debe lanzar DatosInvalidosError si el array de roles está vacío o es inválido', async () => {
      const datos = {
        email: 'test@correo.com',
        nombre: 'Juan',
        apellido: 'Pérez',
        password: 'password123',
        roles: []
      };

      await assert.rejects(
        async () => await usuariosServicio.crear(datos),
        (err) => {
          assert.ok(err instanceof DatosInvalidosError);
          return true;
        }
      );
    });

    test('debe hashear la contraseña y llamar al repositorio si los datos son válidos', async () => {
      const datosValidos = {
        email: 'juan@correo.com',
        nombre: 'Juan',
        apellido: 'Pérez',
        password: 'password123',
        roles: [1, 2, 1]
      };

      mock.method(bcrypt, 'hash', async () => 'hash_seguro');
      mock.method(usuariosRepo, 'crearConRoles', async () => ({ id: 1, email: 'juan@correo.com' }));

      const resultado = await usuariosServicio.crear(datosValidos);

      assert.deepEqual(resultado, { id: 1, email: 'juan@correo.com' });
      
      assert.strictEqual(bcrypt.hash.mock.callCount(), 1);
      assert.strictEqual(bcrypt.hash.mock.calls[0].arguments[0], 'password123');

      assert.strictEqual(usuariosRepo.crearConRoles.mock.callCount(), 1);
      const argumentoEnviado = usuariosRepo.crearConRoles.mock.calls[0].arguments[0];
      
      assert.deepEqual(argumentoEnviado.rolesIds, [1, 2]);
      assert.equal(argumentoEnviado.passwordHash, 'hash_seguro');
      assert.equal('password' in argumentoEnviado, false);
    });

    test('normaliza el email (minúsculas y sin espacios)', async () => {
      mock.method(bcrypt, 'hash', async () => 'hash_seguro');
      mock.method(usuariosRepo, 'crearConRoles', async () => ({ id: 1, email: 'juan@correo.com' }));

      await usuariosServicio.crear({
        email: '  JUAN@Correo.COM ', 
        nombre: 'Juan', 
        apellido: 'Pérez',
        password: 'password123', 
        roles: [1],
      });

      assert.equal(usuariosRepo.crearConRoles.mock.calls[0].arguments[0].email, 'juan@correo.com');
    });
  });

  describe('listarRoles()', () => {
    test('debe llamar al repositorio de roles y devolver la lista', async () => {
      const rolesMock = [{ id: 1, codigo: 'ADMINISTRADOR', nombre: 'Administrador' }];
      mock.method(rolesRepo, 'listar', async () => rolesMock);

      const resultado = await usuariosServicio.listarRoles();

      assert.deepEqual(resultado, rolesMock);
      assert.strictEqual(rolesRepo.listar.mock.callCount(), 1);
    });
  });

});