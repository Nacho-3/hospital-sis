const { test, describe, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');

const autenticar = require('../middlewares/autenticar');
const { NoAutenticadoError } = require('../dominio/errores');
const jwt = require('jsonwebtoken'); 

describe('Middleware: autenticar [Nativo]', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = {};
    next = mock.fn();
    mock.reset();
  });

  test('debe lanzar NoAutenticadoError si no viene la cabecera Authorization', () => {
    assert.throws(
      () => autenticar(req, res, next),
      (err) => {
        assert.ok(err instanceof NoAutenticadoError);
        return true;
      }
    );
    assert.strictEqual(next.mock.callCount(), 0);
  });

  test('debe lanzar NoAutenticadoError si la cabecera no empieza con "Bearer "', () => {
    req.headers.authorization = 'Basic token123';

    assert.throws(
      () => autenticar(req, res, next),
      (err) => {
        assert.ok(err instanceof NoAutenticadoError);
        return true;
      }
    );
    assert.strictEqual(next.mock.callCount(), 0);
  });

  test('debe llamar a next() y asignar req.usuario si el token es válido', () => {
    req.headers.authorization = 'Bearer tokenvalido.abc.123';
    const usuarioMock = { id: 1, email: 'admin@correo.com', permisos: ['usuario:crear'] };
    
    mock.method(jwt, 'verify', () => usuarioMock);

    autenticar(req, res, next);

    assert.deepEqual(req.usuario, usuarioMock);
    assert.strictEqual(next.mock.callCount(), 1);
  });

});