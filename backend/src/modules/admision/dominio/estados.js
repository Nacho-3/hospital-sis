const { TransicionInvalidaError } = require('../../../shared/errors/DomainError');
const { TurnoOcupadoError } = require('./errores');

// Patron State del turno.
//
//   disponible -> programado -> confirmado -> en_sala_de_espera -> atendido
//   programado | confirmado -> cancelado
//
// Cada estado implementa solo lo que acepta. El resto cae en la base y lanza
// TransicionInvalidaError. Cancelado no llega a atendido: la historia lo pide
// como error de validacion, no como un cambio de estado.
// 'disponible' no esta en la lista de la consigna. Existe para que el turno
// pueda estar libre antes de la reserva.

class EstadoTurno {
  get nombre() {
    throw new Error('Cada estado define su nombre');
  }

  get etiqueta() {
    return ETIQUETAS[this.nombre];
  }

  rechazar(operacion) {
    throw new TransicionInvalidaError(`Un turno ${this.etiqueta} no puede ${operacion}.`);
  }

  // Reservar un turno que ya no esta libre es el 409 de la HU 1.1,
  // no un error generico de transicion.
  reservar() {
    throw new TurnoOcupadoError();
  }

  confirmar() { this.rechazar('confirmarse'); }
  cancelar() { this.rechazar('cancelarse'); }
  recibir() { this.rechazar('pasar a sala de espera'); }
  atender() { this.rechazar('marcarse atendido'); }
}

class Disponible extends EstadoTurno {
  get nombre() { return 'disponible'; }

  reservar(turno) {
    turno.cambiarA(new Programado());
  }
}

class Programado extends EstadoTurno {
  get nombre() { return 'programado'; }

  confirmar(turno) {
    turno.cambiarA(new Confirmado());
  }

  cancelar(turno) {
    turno.cambiarA(new Cancelado());
  }
}

class Confirmado extends EstadoTurno {
  get nombre() { return 'confirmado'; }

  // El paciente ya reconfirmo. Recien al llegar al mostrador pasa a la sala.
  recibir(turno) {
    turno.cambiarA(new EnSalaDeEspera());
  }

  cancelar(turno) {
    turno.cambiarA(new Cancelado());
  }
}

class EnSalaDeEspera extends EstadoTurno {
  get nombre() { return 'en_sala_de_espera'; }

  atender(turno) {
    turno.cambiarA(new Atendido());
  }
}

class Atendido extends EstadoTurno {
  get nombre() { return 'atendido'; }
}

class Cancelado extends EstadoTurno {
  get nombre() { return 'cancelado'; }

  atender() {
    throw new TransicionInvalidaError('Un turno cancelado no puede pasar a atendido.');
  }
}

const ETIQUETAS = {
  disponible: 'disponible',
  programado: 'programado',
  confirmado: 'confirmado',
  en_sala_de_espera: 'en sala de espera',
  atendido: 'atendido',
  cancelado: 'cancelado',
};

const ESTADOS = {
  disponible: Disponible,
  programado: Programado,
  confirmado: Confirmado,
  en_sala_de_espera: EnSalaDeEspera,
  atendido: Atendido,
  cancelado: Cancelado,
};

function estadoDesde(nombre) {
  const Clase = ESTADOS[nombre];
  if (!Clase) throw new Error(`Estado de turno desconocido: ${nombre}`);
  return new Clase();
}

module.exports = {
  EstadoTurno,
  Disponible,
  Programado,
  Confirmado,
  EnSalaDeEspera,
  Atendido,
  Cancelado,
  estadoDesde,
};
