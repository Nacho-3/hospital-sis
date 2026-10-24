-- Modulo: Identidad y accesos (transversal, no es un circuito clinico).
-- Responsable: SANTI.
-- El resto de los modulos referencia usuarios(id) y no escribe estas tablas.

CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(40) NOT NULL UNIQUE,
  nombre VARCHAR(80) NOT NULL
);

CREATE TABLE IF NOT EXISTS permisos (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(80) NOT NULL UNIQUE,
  descripcion TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rol_permiso (
  rol_id INTEGER NOT NULL REFERENCES roles (id),
  permiso_id INTEGER NOT NULL REFERENCES permisos (id),
  PRIMARY KEY (rol_id, permiso_id)
);

CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nombre VARCHAR(80) NOT NULL,
  apellido VARCHAR(80) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usuario_rol (
  usuario_id INTEGER NOT NULL REFERENCES usuarios (id),
  rol_id INTEGER NOT NULL REFERENCES roles (id),
  PRIMARY KEY (usuario_id, rol_id)
);

-- Roles del diseño. Los actores de las historias que no estan en esta lista
-- (coordinador de agenda, administrativo de piso, limpieza, analista de
-- facturacion) los resuelve SANTI como rol nuevo o como permiso de uno existente.
INSERT INTO roles (codigo, nombre) VALUES
  ('ADMINISTRADOR', 'Administrador'),
  ('MEDICO', 'Médico'),
  ('ENFERMERO', 'Enfermero'),
  ('RECEPCIONISTA', 'Recepcionista'),
  ('PACIENTE', 'Paciente')
ON CONFLICT (codigo) DO NOTHING;
