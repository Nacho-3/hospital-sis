const { estadoDesde } = require('./estados');

// Entidad Turno. Delega cada operacion en su estado actual.
// No sabe nada de la base: el servicio la arma desde la fila bloqueada
// y guarda el estado nuevo despues de la operacion.
class Turno {
  constructor({ id, estado }) {
    this.id = id;
    this.estado = estadoDesde(estado);
  }

  static desdeFila(fila) {
    return new Turno({ id: fila.id, estado: fila.estado });
  }

  get nombreEstado() {
    return this.estado.nombre;
  }

  cambiarA(nuevoEstado) {
    this.estado = nuevoEstado;
  }

  reservar() { this.estado.reservar(this); }
  confirmar() { this.estado.confirmar(this); }
  cancelar() { this.estado.cancelar(this); }
  recibir() { this.estado.recibir(this); }
  atender() { this.estado.atender(this); }
}

module.exports = Turno;
