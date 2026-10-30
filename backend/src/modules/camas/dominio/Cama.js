const { estadoDesde } = require('./estados');

// Entidad Cama. Delega cada operacion en su estado actual (patron State).
// No sabe nada de la base: el repositorio la arma desde una fila y guarda
// el estado nuevo despues de la operacion.
class Cama {
  constructor({ id, codigo, habitacionId, estado, reservadaPara = null }) {
    this.id = id;
    this.codigo = codigo;
    this.habitacionId = habitacionId;
    this.estado = estadoDesde(estado);
    this.reservadaPara = reservadaPara;
  }

  static desdeFila(fila) {
    return new Cama({
      id: fila.id,
      codigo: fila.codigo,
      habitacionId: fila.habitacion_id,
      estado: fila.estado,
      reservadaPara: fila.reservada_para_paciente_id,
    });
  }

  get nombreEstado() {
    return this.estado.nombre;
  }

  // Lo llaman solo los estados.
  cambiarA(nuevoEstado, { reservadaPara = null } = {}) {
    this.estado = nuevoEstado;
    this.reservadaPara = reservadaPara;
  }

  reservar(pacienteId) { this.estado.reservar(this, pacienteId); }
  cancelarReserva() { this.estado.cancelarReserva(this); }
  asignar(pacienteId) { this.estado.asignar(this, pacienteId); }
  liberar() { this.estado.liberar(this); }
  finalizarLimpieza() { this.estado.finalizarLimpieza(this); }
  enviarAMantenimiento() { this.estado.enviarAMantenimiento(this); }
  finalizarMantenimiento() { this.estado.finalizarMantenimiento(this); }
}

module.exports = Cama;
