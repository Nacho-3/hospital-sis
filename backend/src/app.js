const express = require('express');
const cors = require('cors');
const { DomainError } = require('./shared/errors/DomainError');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Cada responsable registra aca las rutas de su modulo, por ejemplo:
// app.use('/api/admision', require('./modules/admision/rutas'));
// app.use('/api/atencion', require('./modules/atencion/rutas'));
// app.use('/api/camas', require('./modules/camas/rutas'));
// app.use('/api/facturacion', require('./modules/facturacion/rutas'));

// Manejo central de errores de negocio (ej: turno ya ocupado, transicion invalida)
app.use((err, req, res, next) => {
  if (err instanceof DomainError) {
    return res.status(err.status).json({ error: err.code, mensaje: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'ERROR_INTERNO', mensaje: 'Error interno del servidor' });
});

module.exports = app;
