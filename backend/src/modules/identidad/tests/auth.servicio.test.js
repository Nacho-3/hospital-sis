const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

const authServicio = require('../servicio/auth.servicio');
const usuariosRepo = require('../repositorio/usuarios.repositorio');
const { CredencialesInvalidasError, DatosInvalidosError } = require('../dominio/errores');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

describe('Auth Servicio - login() [Nativo]', () => {

  beforeEach(() => {
    // Limpieza previa si fuera necesaria
  });

  afterEach(() => {
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

  test('lanza CredencialesInvalidasError si la contraseña no coincide', async () => {
    mock.method(usuariosRepo, 'buscarPorEmail', async () => ({
      id: 1, email: 'ana@hospital.test', password_hash: 'x', activo: true,
    }));
    mock.method(bcrypt, 'compare', async () => false);

    await assert.rejects(
      () => authServicio.login({ email: 'ana@hospital.test', password: 'cualquiera1' }),
      CredencialesInvalidasError
    );
  });

  test('login correcto: devuelve un token firmado y no expone el hash', async () => {
    process.env.JWT_SECRET = 'secreto-solo-para-tests';
    mock.method(usuariosRepo, 'buscarPorEmail', async () => ({
      id: 7, email: 'ana@hospital.test', nombre: 'Ana', apellido: 'Gómez',
      password_hash: 'hash', activo: true,
    }));
    mock.method(bcrypt, 'compare', async () => true);
    mock.method(usuariosRepo, 'obtenerPermisos', async () => ['usuario:crear']);

    const r = await authServicio.login({ email: '  ANA@Hospital.test ', password: 'clave12345' });

    assert.equal(usuariosRepo.buscarPorEmail.mock.calls[0].arguments[0], 'ana@hospital.test');
    assert.equal(r.usuario.password_hash, undefined);
    assert.deepEqual(r.usuario.permisos, ['usuario:crear']);

    const decodificado = jwt.verify(r.token, 'secreto-solo-para-tests');
    assert.equal(decodificado.id, 7);
    assert.deepEqual(decodificado.permisos, ['usuario:crear']);
  });

});