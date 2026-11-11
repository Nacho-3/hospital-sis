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
- `pacientes` es de Admisión e `insumos` es de Camas: acá solo se leen.
- `nomenclador` y `cargos.nomenclador_id` están en el esquema pero todavía no se usan.

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
| `publica` | 0 | `estado` |
| `prepaga` | `copago_fijo` (nunca más que el total) | `obra_social` |

Un tipo nuevo es una clase nueva registrada en `ESTRATEGIAS`. Decisiones:

- **No se guardan cargos de $0.** En una cobertura pública el paciente no tiene cargo, en vez de tener uno de $0.
- **La plata se calcula en centavos** (`dominio/dinero.js`) para que las partes siempre sumen el total.
- **El reparto se calcula solo en el backend.** El frontend muestra lo que devuelve la API.

## Cargos automáticos (HU 2.1)

Facturación escucha `MedicacionAdministrada` `{ administracionId, pacienteId, insumoId, cantidad }` (Atención). En una sola transacción:

1. Busca el precio vigente del insumo en `precios_insumo` (el último con `vigente_desde <= hoy`).
2. Reparte `precio × cantidad` con la estrategia de la cobertura vigente.
3. Abre la cuenta activa del paciente si no tenía y guarda un cargo por destinatario.

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
| `GET /coberturas` | Catálogo de coberturas |
| `GET /precios-insumo` | Precio vigente de cada insumo |
| `GET /cobertura/:pacienteId` | Cobertura vigente (particular si no tiene) |
| `PUT /cobertura/:pacienteId` | Cambia la cobertura: `{ coberturaId }`, `null` = particular |
| `GET /cuenta/:pacienteId` | Cuenta activa, cargos y totales por destinatario |
| `POST /cuenta/:pacienteId/cargos` | Cargo manual: `{ concepto, monto }` |
| `POST /simulacion/medicacion-administrada` | **Temporal, solo fuera de producción.** Publica el evento por Atención |

Errores: `400 DATOS_INVALIDOS`, `404 NO_ENCONTRADO`, `409 CONFLICTO_DE_CONCURRENCIA`, `409 PRECIO_NO_DEFINIDO`, `422 COBERTURA_INVALIDA`.

## Pendientes

- **Permisos.** Ninguna ruta pide usuario: cualquiera puede ver una cuenta o cargarle un cargo. Depende de Identidad. Cuando esté, los cargos manuales deberían guardar qué usuario los creó.
- **Ruta de simulación.** Borrar `rutas/simulacion.js` cuando Atención publique `MedicacionAdministrada`.
- **Cierre de cuenta.** `cuentas.estado = 'cerrada'` existe en el esquema y ningún código lo usa.
- **Prestaciones por nomenclador y reportes administrativos** del diseño: sin implementar.

## Cómo probar

```bash
cd backend
node --test                 # unitarios (Strategy y validaciones)
DB_TESTS=1 node --test      # suma los tests contra la base local
```

Para probar en la pantalla hacen falta pacientes: `psql -U postgres -d his -f docs/facturacion-pacientes-demo.sql`.
