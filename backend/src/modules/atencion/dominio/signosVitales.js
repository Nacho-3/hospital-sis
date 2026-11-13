// Solo la temperatura (> 39) viene de la HU; el resto son supuestos editables.
const RANGOS = {
  temperatura:        { max: 39 },
  frecuenciaCardiaca: { min: 50, max: 120 },
  presionSistolica:   { min: 90, max: 180 },
  presionDiastolica:  { min: 50, max: 110 },
};

function evaluarSignosVitales(valores) {
  const fuera = [];
  for (const [campo, { min, max }] of Object.entries(RANGOS)) {
    const v = valores[campo];
    if (v == null) continue;
    if ((min !== undefined && v < min) || (max !== undefined && v > max)) fuera.push(campo);
  }
  return { fueraDeRango: fuera.length > 0, camposFueraDeRango: fuera };
}

function validarEntrada(v) {
  const campos = Object.keys(RANGOS);
  const presentes = campos.filter((c) => v[c] != null);
  if (presentes.length === 0) throw new ErrorNegocio('Ingresá al menos un signo vital', 'SIN_VALORES', 400);
  if (presentes.some((c) => typeof v[c] !== 'number' || Number.isNaN(v[c])))
    throw new ErrorNegocio('Los signos vitales deben ser numéricos', 'VALOR_INVALIDO', 400);
  if ((v.presionSistolica == null) !== (v.presionDiastolica == null))
    throw new ErrorNegocio('La presión requiere sistólica y diastólica', 'PRESION_INCOMPLETA', 400);
}
module.exports = { RANGOS, evaluarSignosVitales, validarEntrada };