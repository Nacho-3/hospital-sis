# Módulo de Camas y Recursos

Responsable: ALEJO. Código en `backend/src/modules/camas`, `frontend/src/modules/camas` y `backend/src/shared/db/schema/30-camas.sql`.

## Modelo de entidades

```
Habitacion (id, numero, piso, tipo, capacidad)
  1 ──── N  Cama (id, codigo, habitacion_id, estado, reservada_para_paciente_id)
              1 ──── N  AsignacionCama (id, paciente_id, cama_id,
                                       fecha_hora_ingreso, fecha_hora_egreso, motivo, motivo_egreso)
                                       fecha_hora_egreso NULL = vigente

Insumo (id, nombre, categoria, unidad_medida)
  1 ──── N  InventarioPiso (id, piso, insumo_id, stock_actual, stock_minimo)   único por (piso, insumo)
              1 ──── N  MovimientoStock (cantidad, stock_resultante, motivo, evento_origen, paciente_id)
```

- `tipo` de habitación: `individual`, `compartida`, `uti`, `guardia`.
- `pacientes` es de Admisión: acá solo se lee y se guarda `paciente_id`.
- Atención (`indicaciones.insumo_id`, `signos_vitales.cama_id`) y Facturación (`precios_insumo.insumo_id`) referencian estas tablas pero no las escriben.

## Estados de la cama (patrón State)

```
disponible ──reservar──> reservada ──asignar──> ocupada ──liberar──> en_limpieza ──finalizarLimpieza──> disponible
disponible ──asignar──> ocupada
reservada  ──cancelarReserva──> disponible
disponible | en_limpieza ──enviarAMantenimiento──> en_mantenimiento ──finalizarMantenimiento──> disponible
```

Cada estado es una clase en `dominio/estados.js` que sobrescribe solo las operaciones que acepta. El resto cae en la clase base y lanza `TransicionInvalidaError` (422). Una cama ocupada nunca pasa directo a disponible.

## Reglas de negocio y dónde se cumplen

| Regla | Código | Base de datos |
|---|---|---|
| Solo se asigna una cama disponible, o reservada para ese paciente | Estados `Disponible` y `Reservada` | — |
| Un paciente no tiene dos asignaciones vigentes | `validarPaciente` | índice único `asignaciones_paciente_vigente_uidx` |
| Una cama no tiene dos asignaciones vigentes | `SELECT ... FOR UPDATE` + estado `Ocupada` | índice único `asignaciones_cama_vigente_uidx` |
| Una habitación no supera su capacidad | `crearCama` bloquea la habitación y cuenta | — |
| Al liberar se cierra la asignación y la cama queda en limpieza | `liberar` + estado `Ocupada` | — |
| El traslado es atómico | `trasladar`: una transacción, camas bloqueadas en orden de id | — |
| El stock no queda negativo | `UPDATE ... WHERE stock_actual >= n` | `CHECK (stock_actual >= 0)` |
| Alerta cuando `stock_actual <= stock_minimo` | `StockBajoDetectado` | — |

## Concurrencia: por qué bloqueo pesimista

La HU 1.1 pide que, si dos administrativos asignan la misma cama a la vez, pase solo el primero. Se usa **bloqueo pesimista** (`SELECT ... FOR UPDATE` sobre la fila de la cama):

1. La primera transacción toma la fila y la segunda espera.
2. Cuando la primera hace COMMIT, la segunda entra y lee la cama ya ocupada.
3. El estado `Ocupada` responde con `ConcurrenciaError` (409, "la cama acaba de ser ocupada").

Se eligió pesimista porque una asignación es corta y la colisión es justo el caso que hay que resolver bien. Con bloqueo optimista (columna `version`) el segundo pedido fallaría igual, pero recién al final y habría que reintentar. Además, los índices únicos parciales son una red de seguridad: aunque un error de código saltara el chequeo, la base rechaza la segunda asignación vigente.

Para el stock no hace falta `FOR UPDATE`: el descuento es una sola sentencia `UPDATE` que resta solo si alcanza, y PostgreSQL ordena las que tocan la misma fila.

## Eventos

**Consume** (catálogo compartido `shared/events/eventos.js`):

| Evento | De | Qué hace Camas |
|---|---|---|
| `PacienteDadoDeAlta` `{ pacienteId, camaId }` | Atención | Libera la cama del paciente: pasa a `en_limpieza` |
| `MedicacionAdministrada` `{ administracionId, pacienteId, insumoId, cantidad }` | Atención | Descuenta el insumo del piso donde está internado el paciente. El mismo `administracionId` no descuenta dos veces |

**Publica** (definidos en `modules/camas/dominio/eventos.js` hasta que otro módulo los use):

| Evento | Carga |
|---|---|
| `CamaAsignada` | `{ asignacionId, camaId, codigoCama, pacienteId, fechaHoraIngreso }` |
| `CamaLiberada` | `{ asignacionId, camaId, codigoCama, pacienteId, fechaHoraIngreso, fechaHoraEgreso, dias, motivoEgreso }` |
| `PacienteTrasladado` | `{ pacienteId, camaOrigenId, camaDestinoId, asignacionCerradaId, asignacionNuevaId }` |
| `StockBajoDetectado` | `{ inventarioPisoId, piso, insumoId, insumo, stockActual, stockMinimo }` |
| `CamaEstadoCambiado` | `{ camaId, codigoCama, estadoAnterior, estadoNuevo }` |

`CamaLiberada.dias` cuenta todo día empezado, con mínimo 1: sirve para la Prestación de tipo internación de Facturación. Un traslado cierra una asignación (`motivoEgreso: 'traslado'`) y abre otra; Facturación decide si suma los tramos.

Los eventos se publican **después del COMMIT**, para que nadie reaccione a algo que terminó en ROLLBACK.

## API (`/api/camas`)

| Método | Ruta | Cuerpo |
|---|---|---|
| GET | `/` | Mapa de camas. Filtros `?piso=&estado=` |
| GET | `/:id`, `/:id/historial` | — |
| POST | `/` | `{ codigo, habitacionId }` |
| GET, POST | `/habitaciones` | `{ numero, piso, tipo, capacidad }` |
| GET | `/pacientes-sin-cama` | — |
| POST | `/:id/asignar` | `{ pacienteId, motivo? }` |
| POST | `/:id/reservar` | `{ pacienteId }` |
| POST | `/:id/cancelar-reserva` | — |
| POST | `/:id/liberar` | `{ motivoEgreso? }` (`alta`, `traslado`, `otro`) |
| POST | `/:id/finalizar-limpieza` | — |
| POST | `/:id/mantenimiento`, `/:id/finalizar-mantenimiento` | — |
| POST | `/pacientes/:pacienteId/trasladar` | `{ camaDestinoId, motivo? }` |
| GET | `/en-vivo` | Server-Sent Events con los eventos del módulo |
| GET, POST | `/inventario` | Filtros `?piso=&bajo=1`. POST: `{ piso, insumoId, stockMinimo, stockInicial? }` |
| GET, POST | `/inventario/insumos` | `{ nombre, categoria?, unidadMedida? }` |
| GET | `/inventario/:id/movimientos` | — |
| POST | `/inventario/:id/reponer` | `{ cantidad }` |

Errores: `{ error, mensaje }` con 400 (datos inválidos), 404, 409 (concurrencia, cama reservada, paciente ya internado, capacidad, stock) o 422 (transición inválida).

## Permisos

Todas las rutas de `/api/camas` piden un usuario autenticado (`Authorization: Bearer <token>` de Identidad) y el permiso de la matriz. Los middlewares son los de Identidad (`autenticar`, `requierePermiso`); los códigos están juntos en `modules/camas/rutas/permisos.js`.

| Permiso | Roles | Rutas |
|---|---|---|
| `cama:ver_mapa` | Administrativo de piso, Personal de limpieza | `GET /`, `GET /habitaciones`, `GET /:id`, `GET /:id/historial` |
| `cama:asignar` | Administrativo de piso | asignar, reservar, cancelar reserva, liberar, trasladar, `GET /pacientes-sin-cama`, mantenimiento, alta de camas y habitaciones |
| `cama:confirmar_limpieza` | Personal de limpieza | `POST /:id/finalizar-limpieza` |
| `inventario:ver` | Gestor de inventario | `GET /inventario`, `GET /inventario/insumos`, `GET /inventario/:id/movimientos` |
| `inventario:reponer` | Gestor de inventario | `POST /inventario/:id/reponer`, `POST /inventario`, `POST /inventario/insumos` |

La matriz no define permisos para mantenimiento, alta de camas y habitaciones, ni alta de insumos: se asignaron al rol que hace esa tarea (`cama:asignar` y `inventario:reponer`).

**Canal en vivo.** `EventSource` no puede mandar headers, así que `GET /en-vivo` acepta el token como `?token=`. Pide `cama:ver_mapa` o `inventario:ver`, y a cada usuario le llegan solo los eventos de su permiso: `StockBajoDetectado` con `inventario:ver`, el resto con `cama:ver_mapa`.

**Frontend.** La sesión es la de Identidad (`modules/identidad/services/sesion.js`): el login, el cierre de sesión y la vuelta a `/login` los maneja ese módulo. `camas/services/sesion.js` solo toma de ahí el token, para mandarlo en cada pedido, y los permisos, para mostrar las pestañas y botones que el usuario puede usar; el backend vuelve a controlarlos. Si el backend responde 401, Camas cierra la sesión y la app vuelve al login.

Errores: 401 `NO_AUTENTICADO` sin token o con token vencido, 403 `PERMISO_DENEGADO` sin el permiso.

## Tests

- `estados.test.js` y `dias.test.js`: sin base, corren siempre.
- `permisos.test.js`: 401 y 403 de cada rol, sin base; el caso permitido corre con `DB_TESTS=1`.
- `concurrencia.db.test.js`, `movimientos.db.test.js` e `inventario.db.test.js`: contra PostgreSQL. Crean sus datos y los borran al terminar. Para correrlos desde `backend/`:

```powershell
$env:DB_TESTS="1"; node --test "src/modules/camas/**/*.test.js"
```
