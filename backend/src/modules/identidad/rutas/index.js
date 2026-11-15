const { Router } = require('express');

const router = Router();

router.use('/auth', require('./auth.rutas'));
router.use('/roles', require('./roles.rutas'));
router.use('/usuarios', require('./usuarios.rutas'));
router.use('/permisos', require('./permisos.rutas'));

module.exports = router;