Módulo de Identidad y Accesos

Responsable: SANTI. Código en backend/src/modules/identidad, frontend/src/modules/identidad y backend/src/shared/db/schema/10-identidad.sql.

Identidad no es un circuito clínico: autentica usuarios y decide qué puede hacer cada uno. Los demás módulos le piden el usuario y el permiso con dos middlewares, y no escriben estas tablas.

Modelo de entidades
Usuario (id, email, password_hash, nombre, apellido, activo, creado_en)
  1 ──── N  UsuarioRol (usuario_id, rol_id)          clave primaria compuesta
                          N ──── 1  Rol (id, codigo, nombre)
                                      1 ──── N  RolPermiso (rol_id, permiso_id)     clave primaria compuesta
                                                              N ──── 1  Permiso (id, codigo, descripcion)
email es el nombre de ingreso. Es único y se guarda en minúsculas y sin espacios.
password_hash guarda el hash (bcryptjs). La contraseña nunca se guarda ni sale en una respuesta.
activo = false impide ingresar. Los usuarios se desactivan y no se borran, porque otros módulos guardan usuario_id (por ejemplo, quién administró una medicación).
Un usuario puede tener varios roles. Sus permisos son la unión de los permisos de todos sus roles.
Un permiso se escribe recurso:accion (por ejemplo turno:reservar). El código pregunta por permisos, nunca por roles: quién tiene cada permiso se cambia en la base sin tocar código.
pacientes es de Admisión. Identidad no la lee ni la escribe.
Datos iniciales

10-identidad.sql crea las tablas con IF NOT EXISTS y carga 10 roles, 27 permisos y 34 asignaciones. Los INSERT usan ON CONFLICT DO NOTHING y las asignaciones se resuelven por código y no por id, así que el archivo se puede ejecutar en cada arranque sin duplicar nada.

Roles y permisos
Rol	Permisos
ADMINISTRADOR	usuario:crear, usuario:ver, usuario:desactivar, rol:administrar, reportes:ver
PACIENTE	turno:ver_propio
MEDICO	indicacion:prescribir, indicacion:ver, signos_vitales:ver, triaje:ver, agenda:ver, turno:cambiar_estado (a confirmar con Admisión)
ENFERMERO	triaje:registrar, triaje:ver, signos_vitales:registrar, signos_vitales:ver, medicacion:administrar, indicacion:ver
RECEPCIONISTA	paciente:registrar, agenda:ver, turno:reservar, turno:cancelar, turno:cambiar_estado, espera:agregar
COORDINADOR_AGENDAS	turno:insertar_entreturno, agenda:ver
ADMINISTRATIVO_PISO	cama:asignar, cama:ver_mapa
PERSONAL_LIMPIEZA	cama:confirmar_limpieza, cama:ver_mapa
GESTOR_INVENTARIO	inventario:ver, inventario:reponer
ANALISTA_FACTURACION	facturacion:calcular, cuenta_paciente:ver, reportes:ver

Los cinco primeros roles salen del documento de diseño. Los otros cinco son los actores que aparecen en las historias de los demás módulos.

Catálogo de permisos

Los códigos son un contrato con el resto del grupo: si se cambia uno, se rompen las rutas que lo usan. Si falta un permiso, se agrega en 10-identidad.sql y se avisa.

Módulo	Permiso	Descripción
Admisión	paciente:registrar	Registrar un paciente en el sistema
Admisión	agenda:ver	Consultar la agenda médica
Admisión	turno:reservar	Reservar un turno disponible
Admisión	turno:cancelar	Cancelar un turno
Admisión	turno:cambiar_estado	Cambiar el estado de un turno
Admisión	turno:insertar_entreturno	Insertar un entreturno en la agenda
Admisión	turno:ver_propio	Ver los turnos propios (paciente)
Admisión	espera:agregar	Agregar un paciente a la lista de espera
Admisión	triaje:registrar	Registrar y clasificar el triaje de guardia
Admisión	triaje:ver	Ver la cola de espera de guardia y su clasificación
Atención	signos_vitales:registrar	Registrar signos vitales de un paciente internado
Atención	signos_vitales:ver	Consultar signos vitales
Atención	medicacion:administrar	Confirmar la administración de medicación
Atención	indicacion:prescribir	Prescribir indicaciones médicas
Atención	indicacion:ver	Consultar las indicaciones médicas de un paciente
Camas	cama:asignar	Asignar una cama a un paciente
Camas	cama:ver_mapa	Ver el mapa de camas
Camas	cama:confirmar_limpieza	Confirmar que una cama fue higienizada
Camas	inventario:ver	Consultar el stock de insumos
Camas	inventario:reponer	Reponer stock de insumos
Facturación	facturacion:calcular	Calcular el costo de una prestación
Facturación	cuenta_paciente:ver	Consultar la cuenta de un paciente
Facturación	reportes:ver	Ver reportes administrativos
Identidad	usuario:crear	Crear usuarios y asignarles roles
Identidad	usuario:ver	Listar y consultar usuarios
Identidad	usuario:desactivar	Desactivar un usuario
Identidad	rol:administrar	Crear roles y editar sus permisos
Capas
rutas/         HTTP: llama al servicio y devuelve su resultado. Sin SQL ni reglas.
servicio/      Validación de entradas, hash de contraseñas y firma/verificación del token.
repositorio/   Todo el SQL del módulo. Traduce los errores de PostgreSQL a errores de negocio.
dominio/       Errores del módulo (extienden DomainError).
middlewares/   autenticar y requierePermiso.
index.js       Lo que el módulo ofrece a los demás: { autenticar, requierePermiso }.

Los errores lanzados (throw) llegan al manejador central de app.js. Los handlers async usan try/catch con next(err), porque Express 4 no captura solo los errores de código asíncrono.

Ingreso y sesión

POST /api/identidad/auth/login con { email, password }:

Normaliza el email (minúsculas y sin espacios) y busca al usuario.
Si no existe, está inactivo o la contraseña no coincide, responde el mismo error (CREDENCIALES_INVALIDAS), para no revelar qué usuarios existen.
Busca los permisos del usuario (unión de todos sus roles) y firma un token JWT con { id, email, permisos }, válido por 8 horas.
Devuelve { token, usuario: { id, email, nombre, apellido, permisos } }.

Las contraseñas tienen entre 8 y 12 caracteres (bcrypt solo usa los primeros 72 bytes). El token viaja en Authorization: Bearer <token>.

Cómo proteger una ruta desde otro módulo
js
const { autenticar, requierePermiso } = require('../../identidad');

router.get('/', autenticar, requierePermiso('cama:ver_mapa'), async (req, res, next) => {
  // req.usuario = { id, email, permisos, iat, exp }
});
El orden es obligatorio: autenticar primero, porque deja req.usuario y requierePermiso lo lee.
requierePermiso() sin código lanza un error al definir la ruta, así que el servidor no arranca con una ruta mal armada.
Para guardar quién hizo algo, usar req.usuario.id.
Sin token válido responde 401 NO_AUTENTICADO. Con token pero sin el permiso responde 403 PERMISO_DENEGADO.
API (/api/identidad)
Método y ruta	Permiso	Qué hace
POST /auth/login	público	Valida las credenciales y devuelve el token
GET /roles	usuario:crear	Lista los roles (id, codigo, nombre) para el formulario de alta
POST /usuarios	usuario:crear	Crea un usuario con sus roles: { email, nombre, apellido, password, roles: [ids] }. Responde 201 con { mensaje, usuario: { id, email } }

Formato de los errores: { "error": "CODIGO", "mensaje": "texto" }.

Estado	Código	Cuándo
400	DATOS_INVALIDOS	Faltan campos, el email no tiene formato, la contraseña es corta o larga, los roles no son una lista de enteros
400	ROL_INEXISTENTE	Alguno de los roles no existe
401	CREDENCIALES_INVALIDAS	Usuario inexistente, inactivo o contraseña incorrecta
401	NO_AUTENTICADO	Falta el token, está mal formado, está vencido o su firma no es válida
403	PERMISO_DENEGADO	El usuario no tiene el permiso de la ruta
409	EMAIL_YA_REGISTRADO	Ya existe un usuario con ese email
Reglas y dónde se cumplen
Regla	Código	Base de datos
El email es único	Se normaliza en el servicio	UNIQUE (email); el código 23505 se traduce a EMAIL_YA_REGISTRADO
Un usuario no queda sin roles	El servicio exige al menos un rol	Usuario y roles se insertan en una sola sentencia (WITH), que es atómica
Un rol existe	—	Clave foránea; el código 23503 se traduce a ROL_INEXISTENTE
Un rol no se repite en un usuario	El servicio elimina repetidos	Clave primaria (usuario_id, rol_id)
La contraseña no se guarda ni se devuelve	Hash con bcryptjs; las respuestas no incluyen password_hash	password_hash NOT NULL
Un usuario inactivo no ingresa	El login lo rechaza	activo BOOLEAN NOT NULL DEFAULT TRUE
El token no se puede falsificar	Se verifica la firma con JWT_SECRET y el vencimiento	—
Frontend
Archivo	Para qué sirve
services/sesion.js	Guarda el token y el usuario (en localStorage, clave his.sesion). Expone haySesion, nombreCompleto, iniciarSesion, cerrarSesion y tienePermiso(codigo)
services/identidadApi.js	Cliente HTTP del módulo. Envía el token y cierra la sesión si el backend responde 401
views/LoginView.vue	Pantalla de ingreso (/login)
views/CrearUsuarioView.vue	Alta de usuarios para quien tenga usuario:crear (/identidad/usuarios/nuevo). Los roles se cargan de GET /roles

Las pantallas usan solo las variables y clases de shared/estilos.css. Ocultar o mostrar algo según el permiso es una ayuda visual: quien protege de verdad es el backend.

Variables de entorno (backend/.env)
Variable	Para qué sirve
JWT_SECRET	Clave con la que se firman los tokens. Cada máquina genera la suya (node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ADMIN_EMAIL	Email del administrador inicial
ADMIN_PASSWORD	Contraseña del administrador inicial (mínimo 8 caracteres)
Usuario administrador inicial

Con el backend ya levantado una vez (para que se aplique el esquema y existan los roles):

bash
cd backend
node src/modules/identidad/scripts/crearAdmin.js

Crea el usuario con rol ADMINISTRADOR a partir de ADMIN_EMAIL y ADMIN_PASSWORD. Si ya existe, lo avisa y no hace nada.

Pendientes
Permisos dentro del token. Si se le quita un permiso o un rol a alguien, sigue valiendo hasta que el token venza (8 horas). Cerrar sesión borra el token del navegador pero no lo invalida en el servidor.
Rutas sin implementar. Los permisos usuario:ver, usuario:desactivar y rol:administrar existen, pero todavía no hay endpoints que los usen. No hay cambio de contraseña: la inicial la define quien da de alta al usuario.
Usuario paciente. usuarios no está vinculado a pacientes, así que turno:ver_propio todavía no puede limitar la consulta a los turnos del paciente logueado. Hace falta acordarlo con Admisión.
Seguridad del ingreso. No hay límite de intentos fallidos. Si el email no existe, el login responde un poco más rápido que si existe (no se ejecuta bcrypt.compare).
Decisiones con otros módulos. turno:cambiar_estado para el rol MEDICO (hoy lo tiene, porque la historia no dice quién marca "Atendido") y un permiso para consultar datos de pacientes (paciente:ver), que ninguna historia pide todavía.
Frontend compartido. Falta el guard del router (por ahora cada pantalla de Identidad revisa la sesión por su cuenta), el encabezado con el nombre del usuario y "Cerrar sesión", y un cliente HTTP común: el pedir de cada módulo no envía el token, así que cuando se protejan sus rutas van a recibir 401.
Protección de las rutas de los demás módulos. Hoy ninguna usa autenticar ni requierePermiso. Cada responsable decide cuándo hacerlo.
Cómo probar
bash
cd backend
node --test src/modules/identidad

Los tests son unitarios y usan mocks (node:test): cubren los middlewares, el login y la validación del alta, sin base de datos. Para probar el recorrido completo, levantar backend y frontend, ingresar en /login con el administrador inicial y crear un usuario desde /identidad/usuarios/nuevo.