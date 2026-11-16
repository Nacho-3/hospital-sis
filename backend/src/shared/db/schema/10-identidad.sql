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

-- Roles: los 5 del diseño y los 5 actores que aparecen en las historias de
-- los demas modulos (coordinador de agendas, administrativo de piso, limpieza,
-- gestor de inventario y analista de facturacion).
INSERT INTO roles (codigo, nombre) VALUES
  ('ADMINISTRADOR', 'Administrador'),
  ('MEDICO', 'Médico'),
  ('ENFERMERO', 'Enfermero'),
  ('RECEPCIONISTA', 'Recepcionista'),
  ('PACIENTE', 'Paciente'),
  ('COORDINADOR_AGENDAS', 'Coordinador de agendas'),
  ('ADMINISTRATIVO_PISO', 'Administrativo de piso'),
  ('PERSONAL_LIMPIEZA', 'Personal de limpieza'),
  ('GESTOR_INVENTARIO', 'Gestor de inventario'),
  ('ANALISTA_FACTURACION', 'Analista de facturación')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO permisos (codigo, descripcion) VALUES
  ('paciente:registrar', 'Registrar un paciente en el sistema'),
  ('agenda:ver', 'Consultar la agenda médica'),
  ('turno:reservar', 'Reservar un turno disponible'),
  ('turno:cancelar', 'Cancelar un turno'),
  ('turno:cambiar_estado', 'Cambiar el estado de un turno (confirmado, en sala de espera, atendido)'),
  ('turno:insertar_entreturno', 'Insertar un entreturno en la agenda'),
  ('turno:ver_propio', 'Ver los turnos propios (paciente)'),
  ('espera:agregar', 'Agregar un paciente a la lista de espera'),
  ('triaje:registrar', 'Registrar y clasificar el triaje de guardia'),
  ('triaje:ver', 'Ver la cola de espera de guardia y su clasificación'),
  ('signos_vitales:registrar', 'Registrar signos vitales de un paciente internado'),
  ('signos_vitales:ver', 'Consultar signos vitales'),
  ('medicacion:administrar', 'Confirmar la administración de medicación'),
  ('indicacion:prescribir', 'Prescribir indicaciones médicas'),
  ('indicacion:ver', 'Consultar las indicaciones médicas de un paciente'),
  ('cama:asignar', 'Asignar una cama a un paciente'),
  ('cama:ver_mapa', 'Ver el mapa de camas'),
  ('cama:confirmar_limpieza', 'Confirmar que una cama fue higienizada'),
  ('inventario:ver', 'Consultar el stock de insumos'),
  ('inventario:reponer', 'Reponer stock de insumos'),
  ('facturacion:calcular', 'Calcular el costo de una prestación'),
  ('cuenta_paciente:ver', 'Consultar la cuenta de un paciente'),
  ('reportes:ver', 'Ver reportes administrativos'),
  ('usuario:crear', 'Crear usuarios y asignarles roles'),
  ('usuario:ver', 'Listar y consultar usuarios'),
  ('usuario:desactivar', 'Desactivar un usuario'),
  ('rol:administrar', 'Editar los permisos de cada rol')
ON CONFLICT (codigo) DO UPDATE SET descripcion = EXCLUDED.descripcion;

-- Asignacion de permisos a cada rol. Se resuelve por codigo para no depender
-- de los ids generados.
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
FROM (VALUES
    -- ADMINISTRADOR
    ('ADMINISTRADOR',        'usuario:crear'),
    ('ADMINISTRADOR',        'usuario:ver'),
    ('ADMINISTRADOR',        'usuario:desactivar'),
    ('ADMINISTRADOR',        'rol:administrar'),
    ('ADMINISTRADOR',        'reportes:ver'),
    -- PACIENTE
    ('PACIENTE',             'turno:ver_propio'),
    -- MEDICO
    ('MEDICO',               'indicacion:prescribir'),
    ('MEDICO',               'indicacion:ver'),
    ('MEDICO',               'signos_vitales:ver'),
    ('MEDICO',               'triaje:ver'),
    ('MEDICO',               'agenda:ver'),
    -- ENFERMERO
    ('ENFERMERO',            'triaje:registrar'),
    ('ENFERMERO',            'triaje:ver'),
    ('ENFERMERO',            'signos_vitales:registrar'),
    ('ENFERMERO',            'signos_vitales:ver'),
    ('ENFERMERO',            'medicacion:administrar'),
    ('ENFERMERO',            'indicacion:ver'),
    -- RECEPCIONISTA
    ('RECEPCIONISTA',        'paciente:registrar'),
    ('RECEPCIONISTA',        'agenda:ver'),
    ('RECEPCIONISTA',        'turno:reservar'),
    ('RECEPCIONISTA',        'turno:cancelar'),
    ('RECEPCIONISTA',        'turno:cambiar_estado'),
    ('RECEPCIONISTA',        'espera:agregar'),
    -- COORDINADOR_AGENDAS
    ('COORDINADOR_AGENDAS',  'turno:insertar_entreturno'),
    ('COORDINADOR_AGENDAS',  'agenda:ver'),
    -- ADMINISTRATIVO_PISO
    ('ADMINISTRATIVO_PISO',  'cama:asignar'),
    ('ADMINISTRATIVO_PISO',  'cama:ver_mapa'),
    -- PERSONAL_LIMPIEZA
    ('PERSONAL_LIMPIEZA',    'cama:confirmar_limpieza'),
    ('PERSONAL_LIMPIEZA',    'cama:ver_mapa'),
    -- GESTOR_INVENTARIO
    ('GESTOR_INVENTARIO',    'inventario:ver'),
    ('GESTOR_INVENTARIO',    'inventario:reponer'),
    -- ANALISTA_FACTURACION
    ('ANALISTA_FACTURACION', 'facturacion:calcular'),
    ('ANALISTA_FACTURACION', 'cuenta_paciente:ver'),
    ('ANALISTA_FACTURACION', 'reportes:ver')
) AS v(rol, permiso)
JOIN roles r    ON r.codigo = v.rol
JOIN permisos p ON p.codigo = v.permiso
ON CONFLICT DO NOTHING;

