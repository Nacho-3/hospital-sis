-- Pacientes de las historias de usuario de Facturacion, para probar en la base LOCAL.
-- No forma parte del esquema: `pacientes` la escribe Admision y, hasta que ese
-- modulo este, no hay otra forma de tener un paciente.
-- Correrlo despues de levantar el backend una vez (asi existen las tablas).
-- Se puede correr mas de una vez: no duplica ni pisa coberturas ya asignadas.
--
--   Juan Gómez   -> Obra Social Pública       (HU 1.1, escenario 1)
--   Ana Rojas    -> Medicina Prepaga Premium  (HU 1.1, escenario 2)
--   Carlos López -> particular                (HU 2.1)
INSERT INTO pacientes (nombre, apellido, documento) VALUES
  ('Carlos', 'López', 'DEMO-1001'),
  ('Ana', 'Rojas', 'DEMO-1002'),
  ('Laura', 'Gómez', 'DEMO-1003'),
  ('Juan', 'Gómez', 'DEMO-1004')
ON CONFLICT (documento) DO NOTHING;

INSERT INTO paciente_cobertura (paciente_id, cobertura_id)
SELECT p.id, c.id
FROM (VALUES
  ('DEMO-1004', 'Obra Social Pública'),
  ('DEMO-1002', 'Medicina Prepaga Premium')
) AS a (documento, cobertura)
JOIN pacientes p ON p.documento = a.documento
JOIN coberturas c ON c.nombre = a.cobertura
WHERE NOT EXISTS (
  SELECT 1 FROM paciente_cobertura pc
   WHERE pc.paciente_id = p.id AND pc.vigente_hasta IS NULL
);

SELECT p.id, p.nombre, p.apellido, COALESCE(c.nombre, 'Particular') AS cobertura
  FROM pacientes p
  LEFT JOIN paciente_cobertura pc ON pc.paciente_id = p.id AND pc.vigente_hasta IS NULL
  LEFT JOIN coberturas c ON c.id = pc.cobertura_id
 WHERE p.documento LIKE 'DEMO-%'
 ORDER BY p.id;
