-- Modulo: Historia Clinica Electronica (HCE).
-- Responsable: ALEJO.
--
-- Segun el documento de diseno, la HCE es "el corazon del sistema" y guarda
-- la informacion medica "centralizada e inmutable" del paciente:
-- alergias, antecedentes, evoluciones medicas y estudios.
--
-- Inmutable: los registros clinicos nunca se modifican ni se borran. Un error
-- se corrige con una rectificacion (hc_rectificaciones), que deja el registro
-- original visible, marcado como rectificado, con el motivo y quien lo hizo.
-- La base lo garantiza con un trigger que rechaza UPDATE y DELETE.
--
-- La ficha demografica (pacientes) es de Admision; la HCE solo la lee.
-- Tambien lee, sin modificarlos, datos de Camas (internaciones) y de
-- Atencion (signos vitales, notas, indicaciones, administraciones y
-- protocolos) para mostrarlos en la linea de tiempo del paciente.

CREATE TABLE IF NOT EXISTS hc_alergias (
  id SERIAL PRIMARY KEY,
  paciente_id INTEGER NOT NULL REFERENCES pacientes (id),
  sustancia VARCHAR(120) NOT NULL,
  reaccion VARCHAR(240),
  severidad VARCHAR(10) NOT NULL CHECK (severidad IN ('leve', 'moderada', 'grave')),
  registrado_por INTEGER NOT NULL REFERENCES usuarios (id),
  registrado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hc_antecedentes (
  id SERIAL PRIMARY KEY,
  paciente_id INTEGER NOT NULL REFERENCES pacientes (id),
  tipo VARCHAR(12) NOT NULL CHECK (tipo IN ('familiar', 'personal', 'quirurgico')),
  descripcion TEXT NOT NULL,
  -- Solo para antecedentes familiares (madre, padre, abuelo...).
  parentesco VARCHAR(40),
  registrado_por INTEGER NOT NULL REFERENCES usuarios (id),
  registrado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hc_antecedentes_parentesco CHECK (tipo = 'familiar' OR parentesco IS NULL)
);

-- Evolucion medica: lo que el medico observa y decide en cada visita.
CREATE TABLE IF NOT EXISTS hc_evoluciones (
  id SERIAL PRIMARY KEY,
  paciente_id INTEGER NOT NULL REFERENCES pacientes (id),
  medico_id INTEGER NOT NULL REFERENCES usuarios (id),
  motivo VARCHAR(160),
  diagnostico VARCHAR(240),
  texto TEXT NOT NULL,
  registrado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hc_estudios (
  id SERIAL PRIMARY KEY,
  paciente_id INTEGER NOT NULL REFERENCES pacientes (id),
  tipo VARCHAR(12) NOT NULL CHECK (tipo IN ('laboratorio', 'imagen', 'otro')),
  nombre VARCHAR(160) NOT NULL,
  realizado_el DATE NOT NULL,
  resultado TEXT NOT NULL,
  -- Enlace opcional al informe completo (PDF o imagen en otro sistema).
  enlace VARCHAR(500),
  registrado_por INTEGER NOT NULL REFERENCES usuarios (id),
  registrado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Correccion de un registro clinico. El registro original no se toca:
-- queda marcado como rectificado al leerlo. Un registro se rectifica una vez.
CREATE TABLE IF NOT EXISTS hc_rectificaciones (
  id SERIAL PRIMARY KEY,
  entidad VARCHAR(12) NOT NULL CHECK (entidad IN ('alergia', 'antecedente', 'evolucion', 'estudio')),
  registro_id INTEGER NOT NULL,
  motivo TEXT NOT NULL,
  registrado_por INTEGER NOT NULL REFERENCES usuarios (id),
  registrado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hc_rectificaciones_unica UNIQUE (entidad, registro_id)
);

CREATE INDEX IF NOT EXISTS hc_alergias_paciente_idx ON hc_alergias (paciente_id);
CREATE INDEX IF NOT EXISTS hc_antecedentes_paciente_idx ON hc_antecedentes (paciente_id);
CREATE INDEX IF NOT EXISTS hc_evoluciones_paciente_idx ON hc_evoluciones (paciente_id, registrado_en);
CREATE INDEX IF NOT EXISTS hc_estudios_paciente_idx ON hc_estudios (paciente_id, realizado_el);

-- Inmutabilidad garantizada por la base: aunque el codigo tuviera un error,
-- PostgreSQL rechaza cualquier UPDATE o DELETE sobre la historia clinica.
CREATE OR REPLACE FUNCTION hc_rechazar_cambios() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'La historia clinica es inmutable: % en % no esta permitido', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'P0001', HINT = 'Para corregir un registro, rectificalo.';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER hc_alergias_inmutable
  BEFORE UPDATE OR DELETE ON hc_alergias
  FOR EACH ROW EXECUTE FUNCTION hc_rechazar_cambios();
CREATE OR REPLACE TRIGGER hc_antecedentes_inmutable
  BEFORE UPDATE OR DELETE ON hc_antecedentes
  FOR EACH ROW EXECUTE FUNCTION hc_rechazar_cambios();
CREATE OR REPLACE TRIGGER hc_evoluciones_inmutable
  BEFORE UPDATE OR DELETE ON hc_evoluciones
  FOR EACH ROW EXECUTE FUNCTION hc_rechazar_cambios();
CREATE OR REPLACE TRIGGER hc_estudios_inmutable
  BEFORE UPDATE OR DELETE ON hc_estudios
  FOR EACH ROW EXECUTE FUNCTION hc_rechazar_cambios();
CREATE OR REPLACE TRIGGER hc_rectificaciones_inmutable
  BEFORE UPDATE OR DELETE ON hc_rectificaciones
  FOR EACH ROW EXECUTE FUNCTION hc_rechazar_cambios();

-- Permisos del modulo. Se definen aca, en el archivo de la HCE, para no
-- modificar 10-identidad.sql: las tablas permisos y rol_permiso son las mismas.
-- Se pueden cambiar despues desde la pantalla "Roles y permisos" de Identidad.
INSERT INTO permisos (codigo, descripcion) VALUES
  ('historia:ver', 'Ver la historia clinica de un paciente'),
  ('historia:registrar', 'Registrar alergias, antecedentes y estudios'),
  ('historia:evolucionar', 'Escribir evoluciones medicas'),
  ('historia:rectificar', 'Rectificar un registro de la historia clinica')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
FROM (VALUES
    ('MEDICO',    'historia:ver'),
    ('MEDICO',    'historia:registrar'),
    ('MEDICO',    'historia:evolucionar'),
    ('MEDICO',    'historia:rectificar'),
    ('ENFERMERO', 'historia:ver'),
    ('ENFERMERO', 'historia:registrar')
  ) AS a (rol, permiso)
JOIN roles r ON r.codigo = a.rol
JOIN permisos p ON p.codigo = a.permiso
ON CONFLICT DO NOTHING;
