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

module.exports = router;