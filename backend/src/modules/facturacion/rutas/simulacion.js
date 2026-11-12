const express = require('express');
const eventBus = require('../../../shared/events/eventBus');
const { MEDICACION_ADMINISTRADA } = require('../../../shared/events/eventos');
const { cargaDeMedicacion } = require('../servicio/facturacionServicio');

// TEMPORAL. Montado en /api/facturacion/simulacion y solo si NODE_ENV no es
// 'production'. Atencion todavia no publica MedicacionAdministrada, asi que
// esta ruta lo publica por ella para poder probar el circuito completo:
// evento -> suscriptor -> Strategy -> cargos. Como va por el eventBus real,
// Camas tambien lo recibe y descuenta stock.
// Borrar este archivo (y su router.use en index.js) cuando Atencion publique el evento.
const router = express.Router();

// { pacienteId, insumoId, cantidad?, administracionId? }
router.post('/medicacion-administrada', (req, res) => {
  const pedido = req.body || {};
  const carga = cargaDeMedicacion({
    ...pedido,
    administracionId: pedido.administracionId ?? `sim-${Date.now()}`,
  });
  eventBus.emit(MEDICACION_ADMINISTRADA, carga);
  // 202: el evento se publico; los cargos se generan aparte, en el suscriptor.
  res.status(202).json(carga);
});

module.exports = router;
