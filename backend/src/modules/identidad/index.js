const { Router } = require('express');
const autenticar = require('./middlewares/autenticar');
const requierePermiso = require('./middlewares/requierePermiso');
const authRutas = require('./rutas/auth.rutas');
const usuariosRutas = require('./rutas/usuarios.rutas');

const router = Router();

router.use('/auth', authRutas);
router.use('/', usuariosRutas);

module.exports = {
  router,      
  autenticar, 
  requierePermiso 
};