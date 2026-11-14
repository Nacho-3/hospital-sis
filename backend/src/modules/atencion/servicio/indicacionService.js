async function crear({ pacienteId, medicoId, insumoId, dosis, intervaloHoras, margenMinutos = 30, primeraDosis }) {
  return conTransaccion(async (db) => {
    const ind = await indicacionesRepo.insertar(db, { pacienteId, medicoId, insumoId, dosis, intervaloHoras, margenMinutos });
    await admRepo.insertar(db, { indicacionId: ind.id, programadaPara: primeraDosis });
    return ind;
  });
}