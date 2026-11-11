// La plata se opera en centavos (enteros) para no arrastrar errores de punto
// flotante: 0.1 + 0.2 no da 0.3, pero 10 + 20 siempre da 30.
// Hacia afuera (base y API) los montos van en pesos con dos decimales.

function aCentavos(pesos) {
  return Math.round(pesos * 100);
}

function aPesos(centavos) {
  return centavos / 100;
}

function sumar(montos) {
  return aPesos(montos.reduce((total, monto) => total + aCentavos(monto), 0));
}

module.exports = { aCentavos, aPesos, sumar };
