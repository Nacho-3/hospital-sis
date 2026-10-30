-- Modulo: Gestion de recursos y camas.
-- Responsable: ALEJO.
--
-- Modelo:
--   habitaciones 1 -> N camas
--   camas        1 -> N asignaciones_cama (historico; fecha_hora_egreso NULL = vigente)
--   insumos      1 -> N inventario_piso (un registro por par piso + insumo)
--
-- Otros modulos referencian camas(id) e insumos(id) y no escriben estas tablas.
-- El stock lo descuenta este modulo al escuchar MedicacionAdministrada.
-- El precio de los insumos no vive aca: lo tiene Facturacion.
--
-- Si ya tenias la version anterior de este archivo aplicada, recrea la base local:
--   DROP DATABASE his; CREATE DATABASE his;   y volve a correr npm run dev.

CREATE TABLE IF NOT EXISTS habitaciones (
  id SERIAL PRIMARY KEY,
  numero VARCHAR(20) NOT NULL UNIQUE,
  piso INTEGER NOT NULL,
  tipo VARCHAR(20) NOT NULL
    CHECK (tipo IN ('individual', 'compartida', 'uti', 'guardia')),
  capacidad INTEGER NOT NULL CHECK (capacidad > 0)
);

-- Estados (patron State en dominio/estados.js):
--   disponible -> reservada -> ocupada -> en_limpieza -> disponible
--   disponible | en_limpieza -> en_mantenimiento -> disponible
-- Las transiciones validas las controla el codigo; la base solo valida los valores.
CREATE TABLE IF NOT EXISTS camas (
  id SERIAL PRIMARY KEY,
  -- Codigo visible de la cama, por ejemplo '101-A'.
  codigo VARCHAR(20) NOT NULL UNIQUE,
  habitacion_id INTEGER NOT NULL REFERENCES habitaciones (id),
  estado VARCHAR(20) NOT NULL DEFAULT 'disponible'
    CHECK (estado IN (
      'disponible',
      'reservada',
      'ocupada',
      'en_limpieza',
      'en_mantenimiento'
    )),
  -- Paciente para el que esta reservada. Solo tiene valor en estado reservada.
  reservada_para_paciente_id INTEGER REFERENCES pacientes (id),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT camas_reserva_segun_estado CHECK (
    (estado = 'reservada' AND reservada_para_paciente_id IS NOT NULL)
    OR (estado <> 'reservada' AND reservada_para_paciente_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS camas_habitacion_idx ON camas (habitacion_id);

-- Un paciente no puede tener dos camas reservadas a la vez.
CREATE UNIQUE INDEX IF NOT EXISTS camas_reserva_paciente_uidx
  ON camas (reservada_para_paciente_id)
  WHERE reservada_para_paciente_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS asignaciones_cama (
  id SERIAL PRIMARY KEY,
  paciente_id INTEGER NOT NULL REFERENCES pacientes (id),
  cama_id INTEGER NOT NULL REFERENCES camas (id),
  fecha_hora_ingreso TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- NULL = asignacion vigente.
  fecha_hora_egreso TIMESTAMPTZ,
  motivo VARCHAR(160),
  -- alta | traslado | otro. Lo completa el codigo al cerrar la asignacion.
  motivo_egreso VARCHAR(40),
  CONSTRAINT asignaciones_egreso_posterior CHECK (
    fecha_hora_egreso IS NULL OR fecha_hora_egreso >= fecha_hora_ingreso
  )
);

-- Concurrencia (HU 1.1). El servicio toma la cama con SELECT ... FOR UPDATE
-- y valida el estado dentro de la transaccion. Estos dos indices son la red
-- de seguridad: aunque el codigo fallara, la base rechaza
--   - dos asignaciones vigentes para la misma cama
--   - dos asignaciones vigentes para el mismo paciente
CREATE UNIQUE INDEX IF NOT EXISTS asignaciones_cama_vigente_uidx
  ON asignaciones_cama (cama_id)
  WHERE fecha_hora_egreso IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS asignaciones_paciente_vigente_uidx
  ON asignaciones_cama (paciente_id)
  WHERE fecha_hora_egreso IS NULL;

CREATE INDEX IF NOT EXISTS asignaciones_cama_historial_idx
  ON asignaciones_cama (cama_id, fecha_hora_ingreso);

-- Catalogo de insumos. indicaciones (Atencion) y precios_insumo (Facturacion)
-- guardan insumo_id.
CREATE TABLE IF NOT EXISTS insumos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL UNIQUE,
  categoria VARCHAR(60) NOT NULL DEFAULT 'medicamento',
  unidad_medida VARCHAR(40) NOT NULL DEFAULT 'unidad'
);

CREATE TABLE IF NOT EXISTS inventario_piso (
  id SERIAL PRIMARY KEY,
  piso INTEGER NOT NULL,
  insumo_id INTEGER NOT NULL REFERENCES insumos (id),
  -- El stock no puede quedar negativo (regla de negocio y red de seguridad).
  stock_actual INTEGER NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
  stock_minimo INTEGER NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inventario_piso_unico UNIQUE (piso, insumo_id)
);

-- Trazabilidad de cada cambio de stock (HU 3.1).
CREATE TABLE IF NOT EXISTS movimientos_stock (
  id SERIAL PRIMARY KEY,
  inventario_piso_id INTEGER NOT NULL REFERENCES inventario_piso (id),
  -- Negativo = consumo, positivo = reposicion.
  cantidad INTEGER NOT NULL CHECK (cantidad <> 0),
  stock_resultante INTEGER NOT NULL CHECK (stock_resultante >= 0),
  motivo VARCHAR(40) NOT NULL
    CHECK (motivo IN ('medicacion_administrada', 'reposicion', 'ajuste')),
  -- administracionId de MedicacionAdministrada, para auditoria.
  evento_origen VARCHAR(120),
  paciente_id INTEGER REFERENCES pacientes (id),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS movimientos_stock_inventario_idx
  ON movimientos_stock (inventario_piso_id, creado_en);

-- Si el mismo evento llega dos veces, no se descuenta dos veces.
CREATE UNIQUE INDEX IF NOT EXISTS movimientos_stock_evento_uidx
  ON movimientos_stock (evento_origen)
  WHERE evento_origen IS NOT NULL;

-- Datos de ejemplo para probar el mapa de camas. No pisan datos existentes.
INSERT INTO habitaciones (numero, piso, tipo, capacidad) VALUES
  ('101', 1, 'individual', 1),
  ('102', 1, 'compartida', 2),
  ('103', 1, 'compartida', 2),
  ('201', 2, 'individual', 1),
  ('204', 2, 'compartida', 2),
  ('205', 2, 'compartida', 2),
  ('UTI-1', 3, 'uti', 4),
  ('G-1', 0, 'guardia', 3)
ON CONFLICT (numero) DO NOTHING;

INSERT INTO camas (codigo, habitacion_id)
SELECT c.codigo, h.id
FROM (VALUES
  ('101', '101'),
  ('102-A', '102'), ('102-B', '102'),
  ('103-A', '103'), ('103-B', '103'),
  ('201', '201'),
  ('204-A', '204'), ('204-B', '204'),
  ('205-A', '205'), ('205-B', '205'),
  ('UTI-1-1', 'UTI-1'), ('UTI-1-2', 'UTI-1'), ('UTI-1-3', 'UTI-1'),
  ('G-1-1', 'G-1'), ('G-1-2', 'G-1'), ('G-1-3', 'G-1')
) AS c (codigo, habitacion)
JOIN habitaciones h ON h.numero = c.habitacion
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO insumos (nombre, categoria, unidad_medida) VALUES
  ('Ibuprofeno 400mg', 'medicamento', 'comprimido'),
  ('Paracetamol 500mg', 'medicamento', 'comprimido'),
  ('Solucion fisiologica 500ml', 'medicamento', 'sachet'),
  ('Cateter intravenoso 20G', 'descartable', 'unidad'),
  ('Guantes de examen', 'descartable', 'par')
ON CONFLICT (nombre) DO NOTHING;

-- 50 unidades de Ibuprofeno en el piso 2: el escenario de la HU 3.1.
INSERT INTO inventario_piso (piso, insumo_id, stock_actual, stock_minimo)
SELECT s.piso, i.id, s.stock_actual, s.stock_minimo
FROM (VALUES
  (1, 'Ibuprofeno 400mg', 40, 10),
  (2, 'Ibuprofeno 400mg', 50, 10),
  (1, 'Paracetamol 500mg', 60, 15),
  (2, 'Paracetamol 500mg', 30, 15),
  (2, 'Solucion fisiologica 500ml', 20, 8),
  (2, 'Cateter intravenoso 20G', 12, 5),
  (3, 'Guantes de examen', 100, 30)
) AS s (piso, insumo, stock_actual, stock_minimo)
JOIN insumos i ON i.nombre = s.insumo
ON CONFLICT (piso, insumo_id) DO NOTHING;
