# Módulo de Facturación y Administración

Responsable: GABI. Código en `backend/src/modules/facturacion`, `frontend/src/modules/facturacion` y `backend/src/shared/db/schema/50-facturacion.sql`.

## Modelo de entidades

```
Cobertura (id, nombre, tipo, copago_fijo)
  1 ──── N  PacienteCobertura (paciente_id, cobertura_id, vigente_desde, vigente_hasta)
                              vigente_hasta NULL = vigente; única por paciente

PrecioInsumo (insumo_id, precio, vigente_desde)      único por (insumo, vigente_desde)

Cuenta (id, paciente_id, estado, abierta_en, cerrada_en)      una sola activa por paciente
  1 ──── N  Cargo (concepto, monto, destinatario, destinatario_nombre, insumo_id, evento_origen)
```

- `tipo` de cobertura: `publica`, `prepaga`, `particular`. Un paciente sin cobertura vigente se factura como particular.
- `destinatario` de un cargo: `paciente`, `obra_social`, `estado`.
- `pacientes` es de Admisión e `insumos` es de Camas: acá solo se leen. La búsqueda de pacientes de la pantalla de Facturación lee `pacientes` mientras Admisión no tenga su propia búsqueda.
- `nomenclador` guarda las prestaciones facturables con su valor base ("Consulta Médica General", $15.000).
- `cargos.detalle` guarda el insumo y la cantidad de un cargo automático ("Ibuprofeno 400mg x1") o el código de la prestación.

## Capas

```
rutas/         HTTP: llama al servicio y devuelve su resultado. Sin SQL ni reglas.
suscriptores   Eventos de otros módulos -> servicio.
servicio/      Casos de uso, validación de entradas y transacciones.
dominio/       Reglas puras: Strategy de cobertura, dinero, errores. No conoce la base ni Express.
repositorio/   Todo el SQL del módulo.
```

## Cálculo por cobertura (patrón Strategy, HU 1.1)

`dominio/EstrategiaCobertura.js`. Cada estrategia decide cuánto de un cargo paga el paciente; el resto va a su financiador.

| Tipo | Paciente | Resto |
|---|---|---|
| `particular` | el total | — |
| `publica` | $0 (el cargo se registra igual) | `estado` |
| `prepaga` | `copago_fijo` (nunca más que el total) | `obra_social` |

Un tipo nuevo es una clase nueva registrada en `ESTRATEGIAS`. Decisiones:

- **La parte del paciente se guarda siempre, aunque sea $0.** La HU 1.1 pide el cargo de 0 pesos a su nombre con cobertura pública. La del financiador se guarda solo si tiene algo que pagar.
- **La plata se calcula en centavos** (`dominio/dinero.js`) para que las partes siempre sumen el total.
- **El reparto se calcula solo en el backend.** El frontend muestra lo que devuelve la API.

## Facturar una prestación (HU 1.1)

`POST /cuenta/:pacienteId/prestaciones` con `{ nomencladorId }`. Toma el `valor_base` de la prestación, lo reparte con la estrategia de la cobertura vigente y guarda un cargo por destinatario con el concepto de la prestación (por ejemplo "Consulta Médica General") y `nomenclador_id`.

| Escenario | Cobertura | Paciente | Financiador |
|---|---|---|---|
| HU 1.1 esc. 1 — Juan Gómez | Obra Social Pública | $0 | Estado $15.000 |
| HU 1.1 esc. 2 — Ana Rojas | Medicina Prepaga Premium (copago $3.000) | $3.000 | Prepaga $12.000 |
| Regla particular | Sin cobertura | $15.000 | — |

## Cargos automáticos (HU 2.1)

Facturación escucha `MedicacionAdministrada` `{ administracionId, pacienteId, insumoId, cantidad }` (Atención). En una sola transacción:

1. Busca el precio vigente del insumo en `precios_insumo` (el último con `vigente_desde <= hoy`).
2. Reparte `precio × cantidad` con la estrategia de la cobertura vigente.
3. Abre la cuenta activa del paciente si no tenía y guarda un cargo por destinatario, con el concepto "Insumos de Farmacia", el insumo y la cantidad en `detalle`, y el evento en `evento_origen` para la trazabilidad.

Si falta el precio o el paciente no existe, no se guarda nada y el error queda en la consola del backend (`[facturacion] No se pudo procesar...`): el módulo que publicó el evento no se entera.

## Reglas y dónde se cumplen

| Regla | Código | Base de datos |
|---|---|---|
| El mismo evento no se cobra dos veces | `existenCargosDeEvento` antes de insertar | índice único `cargos_evento_destinatario_uidx` |
| Una sola cuenta activa por paciente | `obtenerOCrearCuentaActiva` con `ON CONFLICT` | índice único `cuentas_activa_por_paciente_uidx` |
| Una sola cobertura vigente por paciente | `asignarCobertura` cierra la anterior en la misma transacción | índice único `paciente_cobertura_vigente_uidx` |
| Un solo precio por insumo y fecha | — | índice único `precios_insumo_vigencia_uidx` |
| Montos mayores a cero y con dos decimales | `servicio/validar.js` | `CHECK (monto >= 0)`, `NUMERIC(12, 2)` |
| Consultar no modifica datos | `cuentaDePaciente` no abre la cuenta | — |

`evento_origen` guarda `medicacion_<administracionId>`. La clave única es el par (evento, destinatario) porque un evento puede generar dos cargos: copago al paciente y resto a la obra social.

## API (`/api/facturacion`)

| Método y ruta | Qué hace |
|---|---|
| `GET /pacientes?q=` | Busca pacientes por nombre y apellido, en cualquier orden y sin importar tildes ni mayúsculas (como mucho 10) |
| `GET /coberturas` | Catálogo de coberturas |
| `GET /nomenclador` | Prestaciones facturables con su valor base |
| `GET /precios-insumo` | Precio vigente de cada insumo |
| `GET /cobertura/:pacienteId` | Cobertura vigente (particular si no tiene) |
| `PUT /cobertura/:pacienteId` | Cambia la cobertura: `{ coberturaId }`, `null` = particular |
| `GET /cuenta/:pacienteId` | Cuenta activa, cargos y totales por destinatario |
| `POST /cuenta/:pacienteId/prestaciones` | Factura una prestación: `{ nomencladorId }` (HU 1.1) |
| `POST /cuenta/:pacienteId/cargos` | Cargo manual: `{ concepto, monto }` |
| `POST /simulacion/medicacion-administrada` | **Temporal, solo fuera de producción.** Publica el evento por Atención |

Errores: `400 DATOS_INVALIDOS`, `404 NO_ENCONTRADO`, `409 CONFLICTO_DE_CONCURRENCIA`, `409 PRECIO_NO_DEFINIDO`, `422 COBERTURA_INVALIDA`.

## Pendientes

- **Permisos.** Ninguna ruta pide usuario: cualquiera puede ver una cuenta o cargarle un cargo. Depende de Identidad. Cuando esté, los cargos manuales deberían guardar qué usuario los creó.
- **Ruta de simulación.** Borrar `rutas/simulacion.js` cuando Atención publique `MedicacionAdministrada`.
- **Cierre de cuenta.** `cuentas.estado = 'cerrada'` existe en el esquema y ningún código lo usa.
- **Reportes administrativos** del diseño: sin implementar.
- **Copago por insumo.** La prepaga cobra el copago fijo en cada cargo, también en los de insumos. Las historias solo lo definen para la consulta; si el copago tiene que ser solo por consulta, se resuelve en la estrategia.

## Cómo probar

```bash
cd backend
node --test                 # unitarios (Strategy y validaciones)
DB_TESTS=1 node --test      # suma los tests contra la base local
```

`tests/historias.db.test.js` reproduce cada escenario de las historias con sus datos exactos.

Para probar en la pantalla hacen falta pacientes: `docs/facturacion-pacientes-demo.sql` crea a Juan Gómez (Obra Social Pública), Ana Rojas (Medicina Prepaga Premium) y Carlos López (particular).
