const { Router } = require('express');
const rolesServicio = require('../servicio/roles.servicio');
const autenticar = require('../middlewares/autenticar');
const requierePermiso = require('../middlewares/requierePermiso');

const router = Router();

router.get('/', autenticar, requierePermiso('rol:administrar'), async (req, res, next) => {
  try {
    res.json(await rolesServicio.listarPermisos());
  } catch (err) {
    next(err);
  }
});

module.exports = router;