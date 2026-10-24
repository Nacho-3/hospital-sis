# Guía de trabajo en equipo

## Reglas de oro

1. **Nadie commitea directo a `main`.** Todo entra por Pull Request.
2. **Cada uno edita solo su módulo:** `backend/src/modules/<modulo>`, `frontend/src/modules/<modulo>` y su archivo en `backend/src/shared/db/schema/`.
3. Si hay que tocar otro archivo de `shared/` (eventos, pool, `applySchema.js`) o el módulo de otro, avisar en el grupo antes. La tabla `pacientes` la escribe Admisión; cambiar sus columnas también se avisa.
4. Ramas cortas: una por historia de usuario, que se integra en uno o dos días.

## Nombres de rama

```
<modulo>/hu-<numero>-<descripcion-corta>

admision/hu-1.1-reserva-turno
admision/hu-2.1-patron-state
camas/hu-1.1-asignacion-cama
facturacion/hu-1.1-strategy-cobertura
```

## Mensajes de commit

Formato: `<tipo>(<modulo>): <que hace>`

```
feat(admision): agrega reserva de turno con lock optimista
fix(camas): corrige transicion de ocupada a limpieza
docs: actualiza DER de admision
test(admision): agrega test de concurrencia en reserva
```

Tipos: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`.

## Flujo diario

```bash
git checkout main
git pull
git checkout -b admision/hu-1.1-reserva-turno

# trabajar, commitear seguido
git add .
git commit -m "feat(admision): agrega entidad Turno"

git push -u origin admision/hu-1.1-reserva-turno
```

Despues abrir un **Pull Request** hacia `main` y pedir revision a un companero.

## Mantener la rama al dia

```bash
git checkout main && git pull
git checkout admision/hu-1.1-reserva-turno
git merge main
```

Hacerlo seguido: los conflictos chicos y tempranos son faciles de resolver.

## Antes de abrir un PR

- [ ] El backend levanta sin errores
- [ ] Los tests de tu modulo pasan
- [ ] Solo tocaste archivos de tu modulo (o avisaste)
- [ ] No hay credenciales ni `.env` en el commit

## Contratos entre modulos

Los eventos que cruzan modulos viven en `backend/src/shared/events/` y se definen
entre todos. Ejemplos: `MedicacionAdministrada` (Atencion -> Camas/Facturacion),
`PacienteDadoDeAlta` (Atencion -> Camas). Cambiar un evento ya acordado requiere avisar al equipo.
