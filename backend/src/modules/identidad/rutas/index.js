const { Router } = require('express');

const router = Router();

router.use('/auth', require('./auth.rutas'));
router.use('/roles', require('./roles.rutas'));
router.use('/usuarios', require('./usuarios.rutas'));

module.exports = router;