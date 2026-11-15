const { Router } = require('express');
const authRutas = require('./auth.rutas');
const usuariosRutas = require('./usuarios.rutas');

const router = Router();

router.use('/auth', authRutas);
router.use('/', usuariosRutas);

module.exports = router;