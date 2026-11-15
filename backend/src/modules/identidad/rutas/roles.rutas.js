const { Router } = require('express');
const rolesServicio = require('../servicio/roles.servicio');
const autenticar = require('../middlewares/autenticar');
const requierePermiso = require('../middlewares/requierePermiso');

const router = Router();

router.get('/', autenticar, requierePermiso('usuario:crear'), async (req, res, next) => {
  try {
    const roles = await rolesServicio.listarRoles();
    res.json(roles);
  } catch (err) {
    next(err);
  }
});

router.post('/', autenticar, requierePermiso('rol:administrar'), async (req, res, next) => {
  try {
    const rol = await rolesServicio.crear(req.body);
    res.status(201).json({ mensaje: 'Rol creado exitosamente', rol });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/permisos', autenticar, requierePermiso('rol:administrar'), async (req, res, next) => {
  try {
    res.json(await rolesServicio.obtenerPermisos(req.params.id));
  } catch (err) {
    next(err);
  }
});

router.put('/:id/permisos', autenticar, requierePermiso('rol:administrar'), async (req, res, next) => {
  try {
    res.json(await rolesServicio.reemplazarPermisos(req.params.id, req.body.permisos));
  } catch (err) {
    next(err);
  }
});

module.exports = router;