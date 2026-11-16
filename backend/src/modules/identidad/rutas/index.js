const { Router } = require('express');
const authRutas = require('./auth.rutas');
const rolesRutas = require('./roles.rutas');
const permisosRutas = require('./permisos.rutas');
const usuariosRutas = require('./usuarios.rutas');

const router = Router();

router.use('/auth', authRutas);
router.use('/roles', rolesRutas);
router.use('/permisos', permisosRutas);
router.use('/usuarios', usuariosRutas);

module.exports = router;