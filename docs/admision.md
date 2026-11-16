# Módulo de Admisión: permisos

Responsable: NACHO. Esta página documenta solo los permisos de `/api/admision`; el resto del módulo está explicado en el código (`backend/src/modules/admision`) y en `20-admision.sql`.

## Permisos

Todas las rutas piden la sesión de Identidad (`Authorization: Bearer <token>`) y un permiso de la matriz (sección 01). Los códigos están en `rutas/permisos.js`; los roles ya están cargados en `10-identidad.sql`. Sin token responde `401 NO_AUTENTICADO`; sin el permiso, `403 PERMISO_DENEGADO`.

| Permiso | Roles | Rutas |
|---|---|---|
| `paciente:registrar` | Recepcionista | `POST /pacientes`, `POST /observacion` |
| `agenda:ver` | Recepcionista, Coordinador de agendas, Médico | `GET /medicos`, `GET /turnos`, `GET /lista-espera` |
| `turno:reservar` | Recepcionista | `POST /turnos/:id/reservar` |
| `turno:cancelar` | Recepcionista | `POST /turnos/:id/cancelar` |
| `turno:cambiar_estado` | Recepcionista | `POST /turnos/:id/confirmar`, `/llegada`, `/atender` |
| `turno:insertar_entreturno` | Coordinador de agendas | `POST /turnos/:id/entreturno`, `POST /turnos` |
| `espera:agregar` | Recepcionista | `GET` y `POST /lista-espera` |
| `triaje:registrar` | Enfermero | `POST /guardia`, `GET /enfermeros` |
| `triaje:ver` | Médico, Enfermero | `GET /guardia` |
| cualquiera de los anteriores | — | `GET /pacientes` (lo usan todas las secciones) |

**Decisiones donde la matriz no define un permiso** (a confirmar por el responsable):

- **Abrir un turno libre** (`POST /turnos`): se asignó al coordinador de agendas, que es quien arma la agenda, con `turno:insertar_entreturno`.
- **Pase a observación** (`POST /observacion`): es un trámite de admisión; se usa `paciente:registrar` (recepción).
- `turno:cambiar_estado` figura en la matriz como "Médico (a confirmar)"; en `10-identidad.sql` solo lo tiene Recepcionista, así que el médico ve la agenda pero no cambia estados.
- `turno:ver_propio` (Paciente) no se usa: ninguna pantalla muestra los turnos del propio paciente.

**Pantalla.** `AgendaView.vue` muestra a cada rol solo sus secciones y botones, y al abrir pide solo lo que ese rol puede ver. El backend vuelve a controlar cada pedido.

## Tests

- `permisos.test.js` (sin base): ninguna ruta queda sin `autenticar`.
- `permisos.db.test.js` (`DB_TESTS=1`): 401 sin token, 403 por rol y acceso permitido para recepcionista, coordinador, enfermero y médico, con usuarios reales.
