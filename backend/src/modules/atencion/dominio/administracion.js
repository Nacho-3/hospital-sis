function dentroDeVentana(programadaPara, ahora, margenMinutos) {
  const programada = new Date(programadaPara).getTime();
  const actual = new Date(ahora).getTime();
  const margen = Number(margenMinutos);
  if (!Number.isFinite(programada) || !Number.isFinite(actual) || !Number.isFinite(margen) || margen < 0) {
    return false;
  }
  return Math.abs(actual - programada) <= margen * 60_000;
}

function siguienteProgramacion(programadaPara, intervaloHoras) {
  const programada = new Date(programadaPara).getTime();
  const intervalo = Number(intervaloHoras);
  if (!Number.isFinite(programada) || !Number.isFinite(intervalo) || intervalo <= 0) {
    throw new TypeError('La fecha programada y el intervalo deben ser válidos');
  }
  return new Date(programada + intervalo * 3_600_000);
}

module.exports = { dentroDeVentana, siguienteProgramacion };