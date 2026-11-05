const pool = require('../../../shared/db/pool');
const eventBus = require('../../../shared/events/eventBus');
const { MEDICACION_ADMINISTRADA } = require('../../../shared/events/eventos');
const facturacionRepositorio = require('../repositorio/facturacionRepositorio');
const { calcularDistribucionCargo } = require('../dominio/EstrategiaCobertura');

class FacturacionServicio {
  constructor() {
    this.inicializarEscuchasDeEventos();
  }

  inicializarEscuchasDeEventos() {
    eventBus.on(MEDICACION_ADMINISTRADA, async (payload) => {
      try {
        await this.procesarCargoPorMedicacion(payload);
      } catch (error) {
        console.error('[Facturacion] Error al procesar cargo por MedicacionAdministrada:', error);
      }
    });
  }

  async procesarCargoPorMedicacion({ administracionId, pacienteId, insumoId, cantidad }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const precioUnitario = await facturacionRepositorio.obtenerPrecioVigenteInsumo(client, insumoId);
      if (precioUnitario === null) {
        console.warn(`[Facturacion] No se encontro precio vigente para el insumo ID: ${insumoId}. No se genero cargo.`);
        await client.query('COMMIT');
        return;
      }

      const cantidadEfectiva = Number(cantidad || 1);
      const montoTotal = precioUnitario * cantidadEfectiva;

      const cobertura = await facturacionRepositorio.obtenerCoberturaActivaPaciente(client, pacienteId);

      const cuentaId = await facturacionRepositorio.obtenerOcrearCuentaActiva(client, pacienteId);
      const distribucionCargos = calcularDistribucionCargo({
        montoTotal,
        cobertura,
        nombrePaciente: `Paciente #${pacienteId}`,
      });

      for (const cargo of distribucionCargos) {
        await facturacionRepositorio.insertarCargo(client, {
          cuentaId,
          concepto: `Insumo / Medicacion (ID: ${insumoId}) x${cantidadEfectiva}`,
          monto: cargo.monto,
          destinatario: cargo.destinatario,
          destinatarioNombre: cargo.destinatarioNombre,
          insumoId,
          eventoOrigen: `medicacion_${administracionId}`, 
        });
      }

      await client.query('COMMIT');
      console.log(`[Facturacion] Cargos generados con exito para la administracion ID: ${administracionId}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = new FacturacionServicio();