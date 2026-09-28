/**
 * Tipos de gastos de penalización por cancelación o modificación.
 * Especificación de la Tabla 8 (Tipos de Gastos de Cancelación).
 */
export enum CancellationFeeType {
  MODIFICATION = 'NMO.HTL.CHT.AMD', // Modificación de reserva
  CANCELLATION = 'NMO.HTL.CHT.CAN', // Cancelación de reserva
  NO_SHOW = 'NMO.HTL.CHT.NSW',      // Pasajero no presentado (No Show)
}
