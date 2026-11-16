const pacientesRepo = require('../repositorio/pacientesRepo');
const pool = require('../../../shared/db/pool');

const buscar = (texto) => pacientesRepo.buscar(pool, (texto ?? '').trim());
module.exports = { buscar };