-- Pacientes de prueba para probar Facturacion en la base LOCAL.
-- No forma parte del esquema: `pacientes` la escribe Admision y, hasta que ese
-- modulo este, no hay otra forma de tener un paciente. Se corre a mano:
--   psql -U postgres -d his -f docs/facturacion-pacientes-demo.sql
-- Se puede correr mas de una vez: no duplica.
INSERT INTO pacientes (nombre, apellido, documento) VALUES
  ('Carlos', 'López', 'DEMO-1001'),
  ('Ana', 'Rojas', 'DEMO-1002'),
  ('Laura', 'Gómez', 'DEMO-1003')
ON CONFLICT (documento) DO NOTHING;

SELECT id, apellido, nombre FROM pacientes WHERE documento LIKE 'DEMO-%' ORDER BY id;
