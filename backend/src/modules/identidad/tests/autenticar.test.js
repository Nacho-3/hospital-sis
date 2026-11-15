const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

const autenticar = require('../middlewares/autenticar');
const authServicio = require('../servicio/auth.servicio');
const { NoAutenticadoError } = require('../dominio/errores');

describe('Middleware: autenticar', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = {};
    next = mock.fn();
  });

  afterEach(() => {
    mock.reset();
  });

  test('sin cabecera Authorization: pasa un NoAutenticadoError a next', async () => {
    await autenticar(req, res, next);

    assert.equal(next.mock.callCount(), 1);
    assert.ok(next.mock.calls[0].arguments[0] instanceof NoAutenticadoError);
    assert.equal(req.usuario, undefined);
  });

  test('cabecera que no empieza con "Bearer ": pasa un NoAutenticadoError a next', async () => {
    req.headers.authorization = 'Basic token123';

    await autenticar(req, res, next);

    assert.equal(next.mock.callCount(), 1);
    assert.ok(next.mock.calls[0].arguments[0] instanceof NoAutenticadoError);
  });

  test('si la sesión no es válida, pasa ese error a next y no deja a nadie en req', async () => {
    req.headers.authorization = 'Bearer abc';
    mock.method(authServicio, 'resolverSesion', async () => {
      throw new NoAutenticadoError();
    });

    await autenticar(req, res, next);

    assert.equal(authServicio.resolverSesion.mock.calls[0].arguments[0], 'abc');
    assert.ok(next.mock.calls[0].arguments[0] instanceof NoAutenticadoError);
    assert.equal(req.usuario, undefined);
  });

  test('con una sesión válida deja el usuario en req y llama a next sin error', async () => {
    req.headers.authorization = 'Bearer tokenvalido';
    const sesion = { id: 1, email: 'admin@hospital.test', permisos: ['usuario:crear'] };
    mock.method(authServicio, 'resolverSesion', async () => sesion);

    await autenticar(req, res, next);

    assert.deepEqual(req.usuario, sesion);
    assert.equal(next.mock.callCount(), 1);
    assert.equal(next.mock.calls[0].arguments.length, 0);
  });

  test('si falla la base de datos, el error pasa tal cual (no se convierte en 401)', async () => {
    req.headers.authorization = 'Bearer tokenvalido';
    const falla = new Error('conexión caída');
    mock.method(authServicio, 'resolverSesion', async () => {
      throw falla;
    });

    await autenticar(req, res, next);

    assert.equal(next.mock.calls[0].arguments[0], falla);
    assert.equal(req.usuario, undefined);
  });
});