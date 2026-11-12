-- Modulo: Facturacion y administracion.
-- Responsable: GABI.
-- El tipo de cobertura elige la estrategia de calculo en codigo:
--   publica   -> el paciente paga 0 y el resto queda a cargo del estado
--   prepaga   -> copago_fijo al paciente y el resto a la obra social
--   particular -> el valor base completo al paciente
-- Los cargos de insumos se crean al escuchar MedicacionAdministrada.
-- El precio se lee de precios_insumo, no de la tabla de stock.

CREATE TABLE IF NOT EXISTS coberturas (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL UNIQUE,
  tipo VARCHAR(20) NOT NULL
    CHECK (tipo IN ('publica', 'prepaga', 'particular')),
  copago_fijo NUMERIC(12, 2) CHECK (copago_fijo IS NULL OR copago_fijo >= 0)
);

-- vigente_hasta NULL = cobertura vigente. Al cambiarla no se borra la fila:
-- se cierra con vigente_hasta y queda como historial.
CREATE TABLE IF NOT EXISTS paciente_cobertura (
  id SERIAL PRIMARY KEY,
  paciente_id INTEGER NOT NULL REFERENCES pacientes (id),
  cobertura_id INTEGER NOT NULL REFERENCES coberturas (id),
  vigente_desde DATE NOT NULL DEFAULT CURRENT_DATE,
  vigente_hasta DATE
);

CREATE UNIQUE INDEX IF NOT EXISTS paciente_cobertura_vigente_uidx
  ON paciente_cobertura (paciente_id)
  WHERE vigente_hasta IS NULL;

-- Prestaciones facturables con su valor base (HU 1.1: "Consulta Medica General").
CREATE TABLE IF NOT EXISTS nomenclador (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(40) NOT NULL UNIQUE,
  descripcion VARCHAR(160) NOT NULL,
  valor_base NUMERIC(12, 2) NOT NULL CHECK (valor_base >= 0)
);

CREATE TABLE IF NOT EXISTS precios_insumo (
  id SERIAL PRIMARY KEY,
  insumo_id INTEGER NOT NULL REFERENCES insumos (id),
  precio NUMERIC(12, 2) NOT NULL CHECK (precio >= 0),
  vigente_desde DATE NOT NULL DEFAULT CURRENT_DATE
);

-- Un solo precio por insumo y fecha de inicio. Reemplaza al indice comun
-- precios_insumo_vigencia_idx, que cubria las mismas columnas.
DROP INDEX IF EXISTS precios_insumo_vigencia_idx;
CREATE UNIQUE INDEX IF NOT EXISTS precios_insumo_vigencia_uidx
  ON precios_insumo (insumo_id, vigente_desde);

CREATE TABLE IF NOT EXISTS cuentas (
  id SERIAL PRIMARY KEY,
  paciente_id INTEGER NOT NULL REFERENCES pacientes (id),
  estado VARCHAR(20) NOT NULL DEFAULT 'activa'
    CHECK (estado IN ('activa', 'cerrada')),
  abierta_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cerrada_en TIMESTAMPTZ
);

-- Una sola cuenta activa por paciente. El codigo la abre con ON CONFLICT
-- sobre este indice, asi dos cargos simultaneos no abren dos cuentas.
CREATE UNIQUE INDEX IF NOT EXISTS cuentas_activa_por_paciente_uidx
  ON cuentas (paciente_id)
  WHERE estado = 'activa';

CREATE TABLE IF NOT EXISTS cargos (
  id SERIAL PRIMARY KEY,
  cuenta_id INTEGER NOT NULL REFERENCES cuentas (id),
  concepto VARCHAR(160) NOT NULL,
  monto NUMERIC(12, 2) NOT NULL CHECK (monto >= 0),
  destinatario VARCHAR(20) NOT NULL
    CHECK (destinatario IN ('paciente', 'obra_social', 'estado')),
  destinatario_nombre VARCHAR(160) NOT NULL,
  nomenclador_id INTEGER REFERENCES nomenclador (id),
  insumo_id INTEGER REFERENCES insumos (id),
  -- 'medicacion_<administracionId>' cuando el cargo nace de MedicacionAdministrada.
  -- NULL en los cargos manuales.
  evento_origen VARCHAR(120),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Detalle de la linea: el insumo y la cantidad en los cargos automaticos
-- ("Ibuprofeno 400mg x1"), el codigo en los de prestacion. Va aparte del
-- concepto porque la HU 2.1 pide el concepto fijo "Insumos de Farmacia".
ALTER TABLE cargos ADD COLUMN IF NOT EXISTS detalle VARCHAR(160);

CREATE INDEX IF NOT EXISTS cargos_cuenta_idx ON cargos (cuenta_id);

-- Si el mismo evento llega dos veces, no se cobra dos veces. Un evento genera
-- como mucho un cargo por destinatario (paciente + obra social, por ejemplo),
-- por eso la clave es el par y no evento_origen solo.
-- Reemplaza al indice comun cargos_evento_origen_idx.
DROP INDEX IF EXISTS cargos_evento_origen_idx;
CREATE UNIQUE INDEX IF NOT EXISTS cargos_evento_destinatario_uidx
  ON cargos (evento_origen, destinatario)
  WHERE evento_origen IS NOT NULL;

-- Datos de ejemplo para probar el modulo. No pisan datos existentes.
-- Las dos primeras son las de los escenarios de la HU 1.1.
INSERT INTO coberturas (nombre, tipo, copago_fijo) VALUES
  ('Obra Social Pública', 'publica', NULL),
  ('Medicina Prepaga Premium', 'prepaga', 3000.00),
  ('OSDE 210', 'prepaga', 2500.00),
  ('Swiss Medical SMG20', 'prepaga', 4000.00),
  ('Salud Publica Provincial', 'publica', NULL)
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO nomenclador (codigo, descripcion, valor_base) VALUES
  ('CONS-GEN', 'Consulta Médica General', 15000.00),
  ('CONS-ESP', 'Consulta con Especialista', 22000.00),
  ('RX-TORAX', 'Radiografía de tórax', 18500.00),
  ('LAB-RUT', 'Laboratorio de rutina', 12000.00)
ON CONFLICT (codigo) DO NOTHING;

-- Precios de los insumos de ejemplo de 30-camas.sql. La fecha es fija para
-- que volver a levantar el backend otro dia no agregue un precio nuevo.
INSERT INTO precios_insumo (insumo_id, precio, vigente_desde)
SELECT i.id, p.precio, DATE '2026-01-01'
FROM (VALUES
  ('Ibuprofeno 400mg', 850.00),
  ('Paracetamol 500mg', 620.00),
  ('Solucion fisiologica 500ml', 4300.00),
  ('Cateter intravenoso 20G', 2900.00),
  ('Guantes de examen', 350.00)
) AS p (insumo, precio)
JOIN insumos i ON i.nombre = p.insumo
ON CONFLICT (insumo_id, vigente_desde) DO NOTHING;
