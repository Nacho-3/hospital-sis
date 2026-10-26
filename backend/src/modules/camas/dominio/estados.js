const { TransicionInvalidaError } = require('../../../shared/errors/DomainError');
const { CamaOcupadaError, CamaReservadaError } = require('./errores');

// Patron State de la cama.
//
//   disponible -> reservada -> ocupada -> en_limpieza -> disponible
//   disponible | en_limpieza -> en_mantenimiento -> disponible
//
// Cada estado sobrescribe solo las operaciones que acepta. Las demas caen en
// la clase base y lanzan TransicionInvalidaError. Una cama ocupada nunca pasa
// directo a disponible: tiene que pasar por limpieza.

class EstadoCama {
  get nombre() {
    throw new Error('Cada estado define su nombre');
  }

  rechazar(cama, operacion) {
    throw new TransicionInvalidaError(
      `La cama ${cama.codigo} está ${this.etiqueta} y no permite ${operacion}.`
    );
  }

  get etiqueta() {
    return ETIQUETAS[this.nombre];
  }

  reservar(cama) { this.rechazar(cama, 'reservarla'); }
  cancelarReserva(cama) { this.rechazar(cama, 'cancelar una reserva'); }
  asignar(cama) { this.rechazar(cama, 'asignar un paciente'); }
  liberar(cama) { this.rechazar(cama, 'liberarla'); }
  finalizarLimpieza(cama) { this.rechazar(cama, 'confirmar la limpieza'); }
  enviarAMantenimiento(cama) { this.rechazar(cama, 'enviarla a mantenimiento'); }
  finalizarMantenimiento(cama) { this.rechazar(cama, 'finalizar un mantenimiento'); }
}

class Disponible extends EstadoCama {
  get nombre() { return 'disponible'; }

  reservar(cama, pacienteId) {
    cama.cambiarA(new Reservada(), { reservadaPara: pacienteId });
  }

  asignar(cama) {
    cama.cambiarA(new Ocupada());
  }

  enviarAMantenimiento(cama) {
    cama.cambiarA(new EnMantenimiento());
  }
}

class Reservada extends EstadoCama {
  get nombre() { return 'reservada'; }

  // Solo el paciente para el que se reservo puede ocuparla.
  asignar(cama, pacienteId) {
    if (Number(cama.reservadaPara) !== Number(pacienteId)) {
      throw new CamaReservadaError(cama.codigo);
    }
    cama.cambiarA(new Ocupada());
  }

  cancelarReserva(cama) {
    cama.cambiarA(new Disponible());
  }
}

class Ocupada extends EstadoCama {
  get nombre() { return 'ocupada'; }

  // Error de concurrencia (409), no de transicion: es lo que recibe el segundo
  // administrativo cuando dos asignan la misma cama a la vez.
  asignar(cama) {
    throw new CamaOcupadaError(cama.codigo);
  }

  // Alta o traslado: la cama queda para limpiar, nunca disponible directo.
  liberar(cama) {
    cama.cambiarA(new EnLimpieza());
  }
}

class EnLimpieza extends EstadoCama {
  get nombre() { return 'en_limpieza'; }

  finalizarLimpieza(cama) {
    cama.cambiarA(new Disponible());
  }

  enviarAMantenimiento(cama) {
    cama.cambiarA(new EnMantenimiento());
  }
}

class EnMantenimiento extends EstadoCama {
  get nombre() { return 'en_mantenimiento'; }

  finalizarMantenimiento(cama) {
    cama.cambiarA(new Disponible());
  }
}

const ETIQUETAS = {
  disponible: 'disponible',
  reservada: 'reservada',
  ocupada: 'ocupada',
  en_limpieza: 'en limpieza',
  en_mantenimiento: 'en mantenimiento',
};

const ESTADOS = {
  disponible: Disponible,
  reservada: Reservada,
  ocupada: Ocupada,
  en_limpieza: EnLimpieza,
  en_mantenimiento: EnMantenimiento,
};

function estadoDesde(nombre) {
  const Clase = ESTADOS[nombre];
  if (!Clase) throw new Error(`Estado de cama desconocido: ${nombre}`);
  return new Clase();
}

module.exports = {
  EstadoCama,
  Disponible,
  Reservada,
  Ocupada,
  EnLimpieza,
  EnMantenimiento,
  ESTADOS,
  estadoDesde,
};
