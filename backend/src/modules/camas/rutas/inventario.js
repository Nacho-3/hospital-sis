const express = require('express');
const inventario = require('../servicio/inventarioServicio');

// Montado en /api/camas/inventario.
const router = express.Router();
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// Stock por piso. Filtros: ?piso=2&bajo=1 (solo los que estan en o bajo el minimo)
router.get('/', h(async (req, res) => {
  res.json(await inventario.inventario(req.query));
}));

// Alta de un insumo en un piso, o cambio de su stock minimo:
// { piso, insumoId, stockMinimo, stockInicial? }
router.post('/', h(async (req, res) => {
  res.json(await inventario.configurar(req.body));
}));

router.get('/insumos', h(async (req, res) => {
  res.json(await inventario.insumos());
}));

// { nombre, categoria?, unidadMedida? }
router.post('/insumos', h(async (req, res) => {
  res.status(201).json(await inventario.crearInsumo(req.body));
}));

router.get('/:id/movimientos', h(async (req, res) => {
  res.json(await inventario.movimientos(req.params.id));
}));

// { cantidad }
router.post('/:id/reponer', h(async (req, res) => {
  res.json(await inventario.reponer(req.params.id, req.body));
}));

module.exports = router;
