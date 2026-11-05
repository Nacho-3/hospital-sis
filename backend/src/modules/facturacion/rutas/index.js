const { Router } = require('express');
const pool = require('../../../shared/db/pool');
const facturacionRepositorio = require('../repositorio/facturacionRepositorio');

const router = Router();

router.get('/health', (req, res) => {
  res.json({ modulo: 'facturacion', status: 'activo' });
});

router.get('/cuenta/:pacienteId', async (req, res, next) => {
    const { pacienteId } = req.params;
    try {
        const cuentaId = await facturacionRepositorio.obtenerOcrearCuentaActiva(pool, pacienteId);

        const cargosRes = await pool.query(
            `SELECT id, concepto, monto, destinatario, destinatario_nombre, creado_en, evento_origen
            FROM cargos
            WHERE cuenta_id = $1
            ORDER BY creado_en DESC;`,
            [cuentaId]
        );

        const totalRes = await pool.query(
           `SELECT COALESCE(SUM(monto), 0) as total FROM cargos WHERE cuenta_id = $1;`,
            [cuentaId] 
        );

        res.json({
            cuentaId,
            pacienteId: Number(pacienteId),
            totalAcumulado: Number(totalRes.rows[0].total),
            cargos: cargosRes.rows,
        });
    }   catch (error) {
        next (error);
    }
});

router.get('/cobertura/:pacienteId', async (req, res, next) => {
    const { pacienteId } = req.params;
    try {
        const cobertura = await facturacionRepositorio.obtenerCoberturaActivaPaciente(pool, pacienteId);
        if (!cobertura) {
            return res.json({ pacienteId: Number(pacienteId), cobertura: { tipó: 'particular', nombre: 'Particular'}});
        }
        res.json({ pacienteId: Number(pacienteId), cobertura });
    }   catch (error) {
        next(error);
    }
});

module.exports = router;