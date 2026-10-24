-- Modulo: Gestion de recursos y camas.
-- Responsable: ALEJO.
-- insumos es el catalogo de stock. Atencion y Facturacion guardan insumo_id
-- y no actualizan el stock: eso lo hace este modulo al escuchar
-- MedicacionAdministrada.

CREATE TABLE IF NOT EXISTS camas (
  id SERIAL PRIMARY KEY,
  -- Codigo de la cama, por ejemplo '101'. habitacion puede repetirse.
  codigo VARCHAR(20) NOT NULL UNIQUE,
  habitacion VARCHAR(20) NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'libre'
    CHECK (estado IN ('libre', 'ocupada', 'en_limpieza', 'bloqueada')),
  paciente_id INTEGER REFERENCES pacientes (id),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Ocupada tiene paciente. Libre, en limpieza y bloqueada no.
  CONSTRAINT camas_ocupacion CHECK (
    (estado = 'ocupada' AND paciente_id IS NOT NULL)
    OR (estado <> 'ocupada' AND paciente_id IS NULL)
  )
);

-- Un paciente en una sola cama a la vez.
CREATE UNIQUE INDEX IF NOT EXISTS camas_paciente_actual_uidx
  ON camas (paciente_id)
  WHERE paciente_id IS NOT NULL;

-- Historial. paciente_id en camas es solo el ocupante actual.
CREATE TABLE IF NOT EXISTS asignaciones_cama (
  id SERIAL PRIMARY KEY,
  cama_id INTEGER NOT NULL REFERENCES camas (id),
  paciente_id INTEGER NOT NULL REFERENCES pacientes (id),
  ingresado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  liberado_en TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS asignaciones_cama_activa_uidx
  ON asignaciones_cama (cama_id)
  WHERE liberado_en IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS asignaciones_paciente_activa_uidx
  ON asignaciones_cama (paciente_id)
  WHERE liberado_en IS NULL;

-- Concurrencia (HU 1.1 de camas): SELECT ... FOR UPDATE de la cama y asignarla
-- solo si estado sigue siendo 'libre'. Al alta, PacienteDadoDeAlta la pasa
-- a 'en_limpieza' y limpia paciente_id. De ahi solo maestranza la deja 'libre'.

-- Stock de un solo deposito (el piso). precio no vive aca: lo tiene Facturacion.
CREATE TABLE IF NOT EXISTS insumos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL UNIQUE,
  unidad VARCHAR(40) NOT NULL DEFAULT 'unidad',
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS movimientos_stock (
  id SERIAL PRIMARY KEY,
  insumo_id INTEGER NOT NULL REFERENCES insumos (id),
  cantidad INTEGER NOT NULL,
  stock_resultante INTEGER NOT NULL CHECK (stock_resultante >= 0),
  motivo VARCHAR(80) NOT NULL,
  -- Id de la administracion que publico MedicacionAdministrada.
  evento_origen VARCHAR(120),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS movimientos_stock_insumo_idx
  ON movimientos_stock (insumo_id);
