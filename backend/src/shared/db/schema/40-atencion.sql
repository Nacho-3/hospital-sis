-- Modulo: Atencion y enfermeria.
-- Responsable: EMA.
-- Al confirmar una administracion publica MedicacionAdministrada.
-- No descuenta stock ni crea cargos: eso lo hacen Camas y Facturacion.
-- El protocolo se arma al recibir PacienteIngresado (patron Builder en codigo).

CREATE TABLE IF NOT EXISTS signos_vitales (
  id SERIAL PRIMARY KEY,
  paciente_id INTEGER NOT NULL REFERENCES pacientes (id),
  enfermero_id INTEGER NOT NULL REFERENCES usuarios (id),
  cama_id INTEGER REFERENCES camas (id),
  presion_sistolica INTEGER,
  presion_diastolica INTEGER,
  frecuencia_cardiaca INTEGER,
  temperatura NUMERIC(4, 1),
  -- Lo marca el codigo cuando un valor sale de rango (por ejemplo temperatura > 39).
  fuera_de_rango BOOLEAN NOT NULL DEFAULT FALSE,
  registrado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS signos_vitales_paciente_idx
  ON signos_vitales (paciente_id, registrado_en);

CREATE TABLE IF NOT EXISTS notas_enfermeria (
  id SERIAL PRIMARY KEY,
  paciente_id INTEGER NOT NULL REFERENCES pacientes (id),
  enfermero_id INTEGER NOT NULL REFERENCES usuarios (id),
  signos_vitales_id INTEGER REFERENCES signos_vitales (id),
  texto TEXT NOT NULL,
  automatica BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS indicaciones (
  id SERIAL PRIMARY KEY,
  paciente_id INTEGER NOT NULL REFERENCES pacientes (id),
  medico_id INTEGER NOT NULL REFERENCES usuarios (id),
  insumo_id INTEGER NOT NULL REFERENCES insumos (id),
  dosis VARCHAR(80) NOT NULL,
  intervalo_horas INTEGER NOT NULL CHECK (intervalo_horas > 0),
  -- Margen de la HU 1.2 para dar la dosis por administrada en horario.
  margen_minutos INTEGER NOT NULL DEFAULT 30 CHECK (margen_minutos >= 0),
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS administraciones (
  id SERIAL PRIMARY KEY,
  indicacion_id INTEGER NOT NULL REFERENCES indicaciones (id),
  enfermero_id INTEGER REFERENCES usuarios (id),
  programada_para TIMESTAMPTZ NOT NULL,
  administrada_en TIMESTAMPTZ,
  cantidad INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'administrada')),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS administraciones_programada_idx
  ON administraciones (programada_para);

-- Resultado del Builder. Los tipos son los dos escenarios de la HU 2.1.
CREATE TABLE IF NOT EXISTS protocolos (
  id SERIAL PRIMARY KEY,
  paciente_id INTEGER NOT NULL REFERENCES pacientes (id),
  tipo VARCHAR(40) NOT NULL
    CHECK (tipo IN ('pre_quirurgico', 'infeccion_respiratoria')),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS protocolo_tareas (
  id SERIAL PRIMARY KEY,
  protocolo_id INTEGER NOT NULL REFERENCES protocolos (id),
  descripcion TEXT NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'realizada'))
);
