const router = require('express').Router();
const ah = (fn) => (req, res, next) => fn(req, res, next).catch(next);   // necesario en Express 4

router.post('/signos-vitales', ah(async (req, res) => {
  const { pacienteId, camaId, presionSistolica, presionDiastolica, frecuenciaCardiaca, temperatura } = req.body;
  const r = await signosService.registrar({
    pacienteId, camaId, presionSistolica, presionDiastolica, frecuenciaCardiaca, temperatura,
    enfermeroId: req.usuario.id,                 // lo setea el middleware de autenticación
  });
  res.status(201).json(r);
}));

router.post('/administraciones/:id/confirmar', ah(async (req, res) => {
  const r = await administracionService.confirmar({
    administracionId: Number(req.params.id), enfermeroId: req.usuario.id,
  });
  res.json(r);
}));

module.exports = router;