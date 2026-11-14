const express = require('express');
const inventario = require('../servicio/inventarioServicio');
const { PERMISOS, con } = require('./permisos');

// Montado en /api/camas/inventario. Lo maneja el gestor de inventario.
const router = express.Router();
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// Stock por piso. Filtros: ?piso=2&bajo=1 (solo los que estan en o bajo el minimo)
router.get('/', con(PERMISOS.VER_INVENTARIO), h(async (req, res) => {
  res.json(await inventario.inventario(req.query));
}));

// Alta de un insumo en un piso, o cambio de su stock minimo:
// { piso, insumoId, stockMinimo, stockInicial? }
// La matriz no tiene un permiso propio: lo usa el gestor, con inventario:reponer.
router.post('/', con(PERMISOS.REPONER_INVENTARIO), h(async (req, res) => {
  res.json(await inventario.configurar(req.body));
}));

router.get('/insumos', con(PERMISOS.VER_INVENTARIO), h(async (req, res) => {
  res.json(await inventario.insumos());
}));

// { nombre, categoria?, unidadMedida? }
router.post('/insumos', con(PERMISOS.REPONER_INVENTARIO), h(async (req, res) => {
  res.status(201).json(await inventario.crearInsumo(req.body));
}));

router.get('/:id/movimientos', con(PERMISOS.VER_INVENTARIO), h(async (req, res) => {
  res.json(await inventario.movimientos(req.params.id));
}));

// { cantidad }
router.post('/:id/reponer', con(PERMISOS.REPONER_INVENTARIO), h(async (req, res) => {
  res.json(await inventario.reponer(req.params.id, req.body));
}));

module.exports = router;
