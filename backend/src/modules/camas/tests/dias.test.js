const test = require('node:test');
const assert = require('node:assert/strict');
const { diasDeInternacion } = require('../servicio/movimientosServicio');

test('internacion de unas horas cuenta como 1 dia', () => {
  assert.equal(diasDeInternacion('2026-10-01T10:00:00Z', '2026-10-01T15:00:00Z'), 1);
});

test('todo dia empezado cuenta', () => {
  assert.equal(diasDeInternacion('2026-10-01T10:00:00Z', '2026-10-03T10:00:00Z'), 2);
  assert.equal(diasDeInternacion('2026-10-01T10:00:00Z', '2026-10-03T10:00:01Z'), 3);
});
