class ProtocoloBuilder {
  constructor(tipo) { this.tipo = tipo; this.tareas = []; }
  agregarTarea(descripcion) { this.tareas.push({ descripcion, estado: 'pendiente' }); return this; }
  build() { return { tipo: this.tipo, tareas: [...this.tareas] }; }
}

class PreOpProtocolBuilder extends ProtocoloBuilder {
  constructor() { super('pre_quirurgico'); }
  agregarAyuno()          { return this.agregarTarea('Verificar ayuno de 8 horas'); }
  agregarViaIntravenosa() { return this.agregarTarea('Colocar vía intravenosa periférica'); }
  agregarControlSignos()  { return this.agregarTarea('Realizar control de signos vitales cada 2 horas'); }
}

class RespiratoryProtocolBuilder extends ProtocoloBuilder {
  constructor() { super('infeccion_respiratoria'); }
  agregarMonitoreoSaturacion() { return this.agregarTarea('Monitoreo de saturación de oxígeno continuo'); }
  agregarAislamiento()         { return this.agregarTarea('Indicación de aislamiento de contacto y gotas'); }
}

const ProtocoloDirector = {
  preQuirurgico: (b = new PreOpProtocolBuilder()) =>
    b.agregarAyuno().agregarViaIntravenosa().agregarControlSignos().build(),
  infeccionRespiratoria: (b = new RespiratoryProtocolBuilder()) =>
    b.agregarMonitoreoSaturacion().agregarAislamiento().build(),
};
module.exports = { ProtocoloBuilder, PreOpProtocolBuilder, RespiratoryProtocolBuilder, ProtocoloDirector };