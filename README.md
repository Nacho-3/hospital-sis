# Hospital Information System (HIS)

Proyecto final. Monolito modular: un solo repositorio, una carpeta por módulo.

## Stack

- **Frontend:** Vue 3 + Vite
- **Backend:** Node.js + Express
- **Base de datos:** PostgreSQL (soporta `SELECT ... FOR UPDATE`, necesario para el control de concurrencia)

## Estructura

```
hospital-his/
├── docs/                 DER, diagramas, decisiones de diseño
├── backend/
│   └── src/
│       ├── shared/       eventos, errores y esquema de la base
│       │   └── db/schema/  un archivo SQL por módulo
│       └── modules/
│           ├── identidad/      usuarios, roles y permisos
│           ├── admision/       pacientes, turnos, entreturnos, triaje
│           ├── atencion/       enfermería, signos vitales, protocolos
│           ├── camas/          camas, estados, inventario
│           └── facturacion/    cobertura, cargos
└── frontend/
    └── src/
        └── modules/      una carpeta por módulo, espejo del backend
```

## Módulos y responsables

| Módulo | Responsable | Archivo SQL |
|--------|-------------|-------------|
| Identidad y accesos | SANTI | `10-identidad.sql` |
| Admisión | NACHO | `20-admision.sql` |
| Camas | ALEJO | `30-camas.sql` |
| Atención | EMA | `40-atencion.sql` |
| Facturación | GABI | `50-facturacion.sql` |

Identidad no es un circuito clínico: autentica usuarios y administra roles. El resto guarda `usuario_id` y no escribe esas tablas. La ficha del paciente (`pacientes`) la escribe Admisión; los demás solo la referencian.

## Cómo levantar el proyecto

```bash
# Una sola vez, en PostgreSQL: CREATE DATABASE his;

# Backend
cd backend
cp .env.example .env     # completar credenciales de la base
npm install
npm run dev              # aplica el esquema y despues escucha
```

Al arrancar, el backend ejecuta `backend/src/shared/db/schema/` en orden. Esos archivos crean lo que falta y no borran datos. Cada persona edita solo el SQL de su módulo.

Si hay que cambiar una columna de una tabla que ya existe, en la máquina local hay que recrear la base (`DROP DATABASE his; CREATE DATABASE his;`) y volver a levantar el backend.

```bash
# Frontend (otra terminal)
cd frontend
npm install
npm run dev
```

## Cómo trabajar

Ver [CONTRIBUTING.md](CONTRIBUTING.md).
