# Historia Clínica Electrónica (HCE)

Es el núcleo del sistema: guarda la información médica del paciente en forma centralizada e **inmutable**.

Cubre lo que pide el documento de diseño:

- ficha demográfica
- alergias
- antecedentes (familiares, personales y quirúrgicos)
- evoluciones médicas
- estudios

Además muestra, sin modificarlos, los datos que cargan los otros módulos:

- signos vitales, notas, indicaciones, administraciones y protocolos (Atención)
- internaciones (Camas)
- turnos (Admisión)

## Archivos

| Capa | Archivo |
|---|---|
| SQL | `backend/src/shared/db/schema/60-historia-clinica.sql` |
| Rutas | `backend/src/modules/historia/rutas/index.js` |
| Servicio | `backend/src/modules/historia/servicio/historiaServicio.js` |
| Dominio | `backend/src/modules/historia/dominio/` (`registros.js`, `lineaDeTiempo.js`, `errores.js`) |
| Repositorio propio | `backend/src/modules/historia/repositorio/historiaRepositorio.js` |
| Lecturas de otros módulos | `backend/src/modules/historia/repositorio/lecturasRepositorio.js` (solo `SELECT`) |
| Tests | `backend/src/modules/historia/tests/` |
| Front | `frontend/src/modules/historia/` (vista `HistoriaView.vue`, componentes, `services/historiaApi.js`) |

Archivos compartidos que se tocaron (una línea cada uno):

- `backend/src/app.js`: monta `/api/historia`
- `frontend/src/router.js`: ruta `/historia`
- `frontend/src/App.vue`: link "Historia clínica" en la barra

## Inmutabilidad

Las tablas `hc_alergias`, `hc_antecedentes`, `hc_evoluciones`, `hc_estudios` y `hc_rectificaciones` tienen un trigger (`hc_rechazar_cambios`) que **rechaza todo `UPDATE` y `DELETE`**. El bloqueo vale aunque alguien entre directo a la base.

Para corregir un error se hace una **rectificación**: un registro nuevo que apunta al original y dice el motivo. El original no se borra. Se sigue viendo tachado y con la marca "Rectificado", junto a quién lo rectificó y cuándo. Cada registro se puede rectificar una sola vez (índice único `hc_rectificaciones_unica`).

## Integración con los otros módulos

La HCE **no escribe nunca** en tablas ajenas. Lee con `SELECT` de solo lectura:

| Módulo | Tablas que lee |
|---|---|
| Admisión | `pacientes` (ficha y búsqueda) y `turnos` |
| Camas | `asignaciones_cama`, `camas` y `habitaciones` |
| Atención | `signos_vitales`, `notas_enfermeria`, `indicaciones`, `administraciones` y `protocolos` |

Los otros módulos siguen funcionando y mostrando sus datos igual que antes; la HCE solo los suma a su vista.

La **línea de tiempo** junta todo en orden cronológico. Usa un adaptador por fuente (`dominio/lineaDeTiempo.js`), que convierte cada registro al formato `{fecha, tipo, origen, titulo, detalle, autor, rectificado, alerta}`. Para sumar una fuente nueva alcanza con escribir su adaptador.

## Permisos

Se definen en `60-historia-clinica.sql`, así no se toca el SQL de Identidad:

| Permiso | Para qué | Roles |
|---|---|---|
| `historia:ver` | Ver historias y buscar pacientes | MEDICO, ENFERMERO |
| `historia:registrar` | Alergias, antecedentes, estudios | MEDICO, ENFERMERO |
| `historia:evolucionar` | Evoluciones médicas | MEDICO |
| `historia:rectificar` | Rectificar registros | MEDICO |

El autor de cada registro sale siempre del token (`req.usuario.id`), nunca del body.

## API (`/api/historia`)

| Método y ruta | Permiso |
|---|---|
| `GET /pacientes?buscar=texto` | ver |
| `GET /pacientes/:id` (resumen: ficha, edad, alergias vigentes, alerta grave, internación actual, últimos signos, última evolución) | ver |
| `GET /pacientes/:id/linea-de-tiempo` | ver |
| `GET` y `POST /pacientes/:id/alergias` | ver / registrar |
| `GET` y `POST /pacientes/:id/antecedentes` | ver / registrar |
| `GET` y `POST /pacientes/:id/evoluciones` | ver / evolucionar |
| `GET` y `POST /pacientes/:id/estudios` | ver / registrar |
| `POST /pacientes/:id/rectificaciones` `{entidad, registroId, motivo}` | rectificar |

Errores que puede devolver:

- `400 DATOS_INVALIDOS`
- `404` si no existe el paciente, o si el registro existe pero es de otro paciente
- `409 ALERGIA_DUPLICADA`: la misma sustancia vigente, sin distinguir mayúsculas ni tildes. Un candado `pg_advisory_xact_lock` por paciente evita que dos cargas simultáneas pasen el control.
- `409 YA_RECTIFICADO`

## Pantalla

1. Buscar al paciente por nombre, apellido o documento. Queda en la URL (`/historia?paciente=12`), así se puede recargar o compartir.
2. La cabecera muestra la ficha, la edad, la **alerta de alergias** (roja si alguna es grave), la internación actual, los últimos signos vitales y la última evolución.
3. Pestañas:
   - Resumen
   - Alergias
   - Antecedentes
   - Evoluciones
   - Estudios
   - Línea de tiempo (con filtro por módulo)
4. Los formularios y el botón "Rectificar" aparecen solo si el usuario tiene el permiso.

## Tests

```
cd backend
node --test "src/modules/historia/**/*.test.js"               # unitarios
DB_TESTS=1 node --test "src/modules/historia/**/*.test.js"    # con base de datos
```

El test con base crea usuarios reales con roles: Identidad resuelve los permisos desde la base en cada request.

Cubre:

- registros y alergia duplicada
- respuestas 403 por rol
- el trigger de inmutabilidad
- la rectificación, incluida la doble y la de otro paciente
- que los datos de Camas y Atención aparezcan en el resumen y en la línea de tiempo
