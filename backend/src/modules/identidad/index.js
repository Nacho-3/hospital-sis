const router = require('./rutas');
const autenticar = require('./middlewares/autenticar');
const requierePermiso = require('./middlewares/requierePermiso');

module.exports = {
  router,       
  autenticar, 
  requierePermiso 
};