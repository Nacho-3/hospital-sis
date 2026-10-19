#You all are gay
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
│       ├── shared/       eventos y errores compartidos entre módulos
│       └── modules/
│           ├── admision/       turnos, entreturnos, standby, triaje
│           ├── atencion/       enfermería, signos vitales, protocolos
│           ├── camas/          camas, estados, inventario
│           └── facturacion/    cobertura, cargos
└── frontend/
    └── src/
        └── modules/      una carpeta por módulo, espejo del backend
```

## Módulos y responsables

| Módulo       | Responsable |
|--------------|-------------|
| Admisión     | (completar) |
| Atención     | (completar) |
| Camas        | (completar) |
| Facturación  | (completar) |

## Cómo levantar el proyecto

```bash
# Backend
cd backend
cp .env.example .env     # completar credenciales de la base
npm install
npm run dev

# Frontend (otra terminal)
cd frontend
npm install
npm run dev
```

## Cómo trabajar

Ver [CONTRIBUTING.md](CONTRIBUTING.md).
