const { Router } = require('express');
const usuariosServicio = require('../servicio/usuarios.servicio');
const autenticar = require('../middlewares/autenticar');
const requierePermiso = require('../middlewares/requierePermiso');

const router = Router();

router.get('/', autenticar, requierePermiso('usuario:crear'), async (req, res, next) => {
  try {
    const roles = await usuariosServicio.listarRoles();
    res.json(roles);
  } catch (err) {
    next(err);
  }
});

module.exports = router;