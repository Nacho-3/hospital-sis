const { test, describe, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');

const authServicio = require('../servicio/auth.servicio');
const usuariosRepo = require('../repositorio/usuarios.repositorio');
const { CredencialesInvalidasError, DatosInvalidosError } = require('../dominio/errores');

describe('Auth Servicio - login() [Nativo]', () => {

  beforeEach(() => {
    mock.reset(); 
  });

  test('debe lanzar DatosInvalidosError si no se pasan email o contraseña', async () => {
    await assert.rejects(
      async () => await authServicio.login({ email: '', password: '' }),
      (err) => {
        assert.ok(err instanceof DatosInvalidosError);
        return true;
      }
    );
  });

  test('debe lanzar CredencialesInvalidasError si el usuario no existe en la base de datos', async () => {
    
    mock.method(usuariosRepo, 'buscarPorEmail', async () => undefined);

    await assert.rejects(
      async () => await authServicio.login({ email: 'noexiste@correo.com', password: '123' }),
      (err) => {
        assert.ok(err instanceof CredencialesInvalidasError);
        return true;
      }
    );
  });

  test('debe lanzar CredencialesInvalidasError si el usuario está inactivo', async () => {
    mock.method(usuariosRepo, 'buscarPorEmail', async () => ({ 
      id: 1, 
      email: 'test@correo.com', 
      activo: false 
    }));

    await assert.rejects(
      async () => await authServicio.login({ email: 'test@correo.com', password: '123' }),
      (err) => {
        assert.ok(err instanceof CredencialesInvalidasError);
        return true;
      }
    );
  });

});