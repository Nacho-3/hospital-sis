const { Router } = require('express');
const usuariosServicio = require('../servicio/usuarios.servicio');
const autenticar = require('../middlewares/autenticar');
const requierePermiso = require('../middlewares/requierePermiso');

const router = Router();

router.post('/', autenticar, requierePermiso('usuario:crear'), async (req, res, next) => {
  try {
    const nuevoUsuario = await usuariosServicio.crear(req.body);
    res.status(201).json({ 
      mensaje: 'Usuario creado exitosamente', 
      usuario: nuevoUsuario 
    });
  } catch (err) {
    next(err);
  }
});

router.get('/', autenticar, requierePermiso('usuario:ver'), async (req, res, next) => {
  try {
    res.json(await usuariosServicio.listar());
  } catch (err) {
    next(err);
  }
});

router.post('/:id/desactivar', autenticar, requierePermiso('usuario:desactivar'), async (req, res, next) => {
  try {
    const usuario = await usuariosServicio.desactivar(req.params.id, req.usuario.id);
    res.json({ mensaje: 'Usuario desactivado', usuario });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/reactivar', autenticar, requierePermiso('usuario:desactivar'), async (req, res, next) => {
  try {
    const usuario = await usuariosServicio.reactivar(req.params.id);
    res.json({ mensaje: 'Usuario reactivado', usuario });
  } catch (err) {
    next(err);
  }
});

module.exports = router;