const { Router } = require('express');
const authServicio = require('../servicio/auth.servicio');

const router = Router();

router.post('/login', async (req, res, next) => {
  try {
    const resultado = await authServicio.login(req.body);
    res.json(resultado);
  } catch (error) {
    next(error); 
  }
});

module.exports = router;