const pacientesRepo = require('../repositorio/pacientesRepo');
const { pool } = require('../../../shared/db/...');   // ajustá a la conexión real de src/shared

const buscar = (texto) => pacientesRepo.buscar(pool, (texto ?? '').trim());
module.exports = { buscar };