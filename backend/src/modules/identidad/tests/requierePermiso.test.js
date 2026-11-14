const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

const requierePermiso = require('../middlewares/requierePermiso');
const { NoAutenticadoError, PermisoDenegadoError } = require('../dominio/errores');

describe('Middleware: requierePermiso [Nativo]', () => {
  let req, res, next;

  beforeEach(() => {
    req = {};
    res = {};
    next = mock.fn();
  });

  afterEach(() => {
    mock.reset();
  });

  test('debe lanzar un error común si no se le pasa un código de permiso al middleware', () => {
    assert.throws(
      () => requierePermiso(null),
      /requierePermiso necesita el código de un permiso/
    );
  });

  test('debe lanzar NoAutenticadoError si req.usuario no existe (no está logueado)', () => {
    const middleware = requierePermiso('usuario:crear');

    assert.throws(
      () => middleware(req, res, next),
      (err) => {
        assert.ok(err instanceof NoAutenticadoError);
        return true;
      }
    );
    assert.strictEqual(next.mock.callCount(), 0);
  });

  test('debe lanzar PermisoDenegadoError si el usuario no tiene el permiso necesario', () => {
    const middleware = requierePermiso('usuario:crear');
    req.usuario = { id: 1, permisos: ['cama:ver_mapa'] }; // Código real

    assert.throws(
      () => middleware(req, res, next),
      (err) => {
        assert.ok(err instanceof PermisoDenegadoError);
        return true;
      }
    );
    assert.strictEqual(next.mock.callCount(), 0);
  });

  test('debe llamar a next() si el usuario posee el permiso requerido', () => {
    const middleware = requierePermiso('usuario:crear');
    req.usuario = { id: 1, permisos: ['cama:ver_mapa', 'usuario:crear'] };

    middleware(req, res, next);

    assert.strictEqual(next.mock.callCount(), 1);
  });

});