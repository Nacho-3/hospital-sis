const pool = require('../../../shared/db/pool');

const facturacionRepositorio = {
  async obtenerCoberturaActivaPaciente(client, pacienteId) {
    const query = `
      SELECT c.id, c.nombre, c.tipo, c.copago_fijo
      FROM paciente_cobertura pc
      JOIN coberturas c ON c.id = pc.cobertura_id
      WHERE pc.paciente_id = $1 AND pc.vigente_hasta IS NULL
      LIMIT 1;
    `;
    const res = await client.query(query, [pacienteId]);
    return res.rows[0] || null; 
  },

  async obtenerPrecioVigenteInsumo(client, insumoId) {
    const query = `
      SELECT precio
      FROM precios_insumo
      WHERE insumo_id = $1 AND vigente_desde <= CURRENT_DATE
      ORDER BY vigente_desde DESC
      LIMIT 1;
    `;
    const res = await client.query(query, [insumoId]);
    return res.rows[0] ? Number(res.rows[0].precio) : null;
  },

  async obtenerOcrearCuentaActiva(client, pacienteId) {
    let query = `SELECT id FROM cuentas WHERE paciente_id = $1 AND estado = 'activa' LIMIT 1;`;
    let res = await client.query(query, [pacienteId]);

    if (res.rows.length > 0) {
      return res.rows[0].id;
    }

    const insertQuery = `
      INSERT INTO cuentas (paciente_id, estado, abierta_en)
      VALUES ($1, 'activa', NOW())
      RETURNING id;
    `;
    const insertRes = await client.query(insertQuery, [pacienteId]);
    return insertRes.rows[0].id;
  },

  async insertarCargo(client, { cuentaId, concepto, monto, destinatario, destinatarioNombre, nomencladorId, insumoId, eventoOrigen }) {
    if (eventoOrigen) {
      const checkDuplicado = await client.query(
        `SELECT id FROM cargos WHERE evento_origen = $1 LIMIT 1;`,
        [eventoOrigen]
      );
      if (checkDuplicado.rows.length > 0) {
        console.log(`[Facturacion] El cargo para el evento ${eventoOrigen} ya fue procesado anteriormente.`);
        return null;
      }
    }

    const query = `
      INSERT INTO cargos (cuenta_id, concepto, monto, destinatario, destinatarioNombre, nomenclador_id, insumo_id, evento_origen, creado_en)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id;
    `;
    const values = [
      cuentaId,
      concepto,
      monto,
      destinatario,
      destinatarioNombre,
      nomencladorId || null,
      insumoId || null,
      eventoOrigen || null,
    ];

    const res = await client.query(query, values);
    return res.rows[0].id;
  },
};

module.exports = facturacionRepositorio;