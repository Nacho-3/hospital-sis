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

CREATE INDEX IF NOT EXISTS precios_insumo_vigencia_idx
  ON precios_insumo (insumo_id, vigente_desde);

CREATE TABLE IF NOT EXISTS cuentas (
  id SERIAL PRIMARY KEY,
  paciente_id INTEGER NOT NULL REFERENCES pacientes (id),
  estado VARCHAR(20) NOT NULL DEFAULT 'activa'
    CHECK (estado IN ('activa', 'cerrada')),
  abierta_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cerrada_en TIMESTAMPTZ
);

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
  -- Id de la administracion cuando el cargo nace de MedicacionAdministrada.
  evento_origen VARCHAR(120),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cargos_cuenta_idx ON cargos (cuenta_id);
CREATE INDEX IF NOT EXISTS cargos_evento_origen_idx ON cargos (evento_origen);
