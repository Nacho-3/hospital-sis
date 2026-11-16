-- Modulo: Admision y turnos.
-- Responsable: NACHO.
-- pacientes es la ficha demografica. La crean y la actualizan desde Admision.
-- El resto puede leerla y guardar paciente_id. No hace INSERT ni UPDATE sobre ella.
-- Cambiar columnas de pacientes se avisa al grupo: todos los modulos la referencian.
--
-- El diseño nombra un modulo de Historia Clinica (alergias, antecedentes,
-- evoluciones, estudios). No tiene historias de usuario ni responsable,
-- asi que esas tablas no estan creadas.

CREATE TABLE IF NOT EXISTS pacientes (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,
  apellido VARCHAR(80) NOT NULL,
  documento VARCHAR(32) UNIQUE,
  fecha_nacimiento DATE,
  telefono VARCHAR(40),
  -- Cuenta de acceso, si el paciente entra al sistema. La maneja Identidad.
  usuario_id INTEGER REFERENCES usuarios (id),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Un turno nace disponible (sin paciente) y pasa a programado al reservarlo.
-- 'disponible' no esta en la tabla de estados de la historia, pero el escenario
-- de reserva habla de un turno que ya existe y esta libre.
-- Las transiciones validas las controla el patron State en el codigo.
CREATE TABLE IF NOT EXISTS turnos (
  id SERIAL PRIMARY KEY,
  medico_id INTEGER NOT NULL REFERENCES usuarios (id),
  paciente_id INTEGER REFERENCES pacientes (id),
  inicio TIMESTAMPTZ NOT NULL,
  fin TIMESTAMPTZ NOT NULL,
  es_entreturno BOOLEAN NOT NULL DEFAULT FALSE,
  duracion_reducida BOOLEAN NOT NULL DEFAULT FALSE,
  estado VARCHAR(32) NOT NULL DEFAULT 'disponible'
    CHECK (estado IN (
      'disponible',
      'programado',
      'confirmado',
      'en_sala_de_espera',
      'atendido',
      'cancelado'
    )),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT turnos_fin_posterior CHECK (fin > inicio),
  CONSTRAINT turnos_paciente_segun_estado CHECK (
    (estado = 'disponible' AND paciente_id IS NULL)
    OR (estado <> 'disponible' AND paciente_id IS NOT NULL)
  ),
  -- Dos turnos del mismo medico no pueden pisarse. El rango es [inicio, fin):
  -- uno que termina a las 10:30 y otro que empieza a las 10:30 conviven.
  -- Un turno cancelado libera el horario.
  CONSTRAINT turnos_sin_solape EXCLUDE USING gist (
    medico_id WITH =,
    tstzrange(inicio, fin, '[)') WITH &&
  ) WHERE (estado <> 'cancelado')
);

CREATE INDEX IF NOT EXISTS turnos_medico_inicio_idx ON turnos (medico_id, inicio);

-- Concurrencia (HU 1.1): en la transaccion, SELECT ... FOR UPDATE de ese turno
-- y recien ahi pasarlo a 'programado' si seguia 'disponible'.
-- Entreturno (HU 1.2): achicar fin del turno anterior y crear el nuevo
-- en la misma transaccion, para que turnos_sin_solape no rechace el hueco.
-- Lista de espera (HU 1.3): al cancelar, en la misma transaccion se toma
-- la menor posicion en_espera de ese medico y ese dia. El turno cancelado
-- conserva a su paciente. El hueco, que ya no ocupa el horario, se abre
-- de nuevo para el primero de la cola.

CREATE TABLE IF NOT EXISTS lista_espera (
  id SERIAL PRIMARY KEY,
  paciente_id INTEGER NOT NULL REFERENCES pacientes (id),
  medico_id INTEGER NOT NULL REFERENCES usuarios (id),
  fecha DATE NOT NULL,
  -- 1 es el primero de la cola.
  posicion INTEGER NOT NULL CHECK (posicion > 0),
  estado VARCHAR(20) NOT NULL DEFAULT 'en_espera'
    CHECK (estado IN ('en_espera', 'asignado', 'cancelado')),
  turno_id INTEGER REFERENCES turnos (id),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS lista_espera_posicion_uidx
  ON lista_espera (medico_id, fecha, posicion)
  WHERE estado = 'en_espera';

CREATE UNIQUE INDEX IF NOT EXISTS lista_espera_paciente_dia_uidx
  ON lista_espera (paciente_id, medico_id, fecha)
  WHERE estado = 'en_espera';

-- Cola de guardia. prioridad 1 es la mas urgente.
-- rojo = Riesgo Vital (HU 3.1). El resto de la escala existe para poder
-- desplazar a los pacientes de menor riesgo. Si la catedra usa otros niveles,
-- se cambian estos CHECK antes de cargar datos.
CREATE TABLE IF NOT EXISTS cola_guardia (
  id SERIAL PRIMARY KEY,
  paciente_id INTEGER NOT NULL REFERENCES pacientes (id),
  enfermero_id INTEGER NOT NULL REFERENCES usuarios (id),
  nivel VARCHAR(16) NOT NULL
    CHECK (nivel IN ('rojo', 'naranja', 'amarillo', 'verde', 'azul')),
  prioridad SMALLINT NOT NULL CHECK (prioridad BETWEEN 1 AND 5),
  posicion INTEGER NOT NULL CHECK (posicion > 0),
  estado VARCHAR(20) NOT NULL DEFAULT 'en_espera'
    CHECK (estado IN ('en_espera', 'en_atencion', 'atendido')),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS cola_guardia_posicion_uidx
  ON cola_guardia (posicion)
  WHERE estado = 'en_espera';

CREATE INDEX IF NOT EXISTS cola_guardia_prioridad_idx
  ON cola_guardia (prioridad, posicion);

-- Escenario de la HU 1.1: el turno de las 10:00 es del Dr. Silva.
-- usuarios lo administra Identidad. Esta fila existe para poder reservar
-- mientras ese modulo no da de alta medicos. No es una contraseña de acceso.
INSERT INTO usuarios (email, password_hash, nombre, apellido)
VALUES ('silva@hospital.test', 'escenario-hu-1.1', 'Andrés', 'Silva')
ON CONFLICT (email) DO NOTHING;

INSERT INTO usuario_rol (usuario_id, rol_id)
SELECT u.id, r.id
FROM usuarios u
JOIN roles r ON r.codigo = 'MEDICO'
WHERE u.email = 'silva@hospital.test'
ON CONFLICT DO NOTHING;
