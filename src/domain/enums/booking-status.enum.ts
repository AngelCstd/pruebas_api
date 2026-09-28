/**
 * Estados de la reserva en Price Navigator (Nemo Group).
 * Especificación de la Tabla 3 (Estados de la Reserva).
 */
export enum BookingStatus {
  CONFIRMED = 'NMO.GBL.BST.CNF',             // Confirmada
  CANCELLED = 'NMO.GBL.BST.CAN',             // Cancelada
  CANCELLED_WITH_CHARGES = 'NMO.GBL.BST.CAC', // Cancelada con Cargos Adicionales
  CANCEL_FAILED = 'NMO.GBL.BST.CNE',          // Fallo en Cancelación - Requiere soporte
  PENDING_CONFIRMATION = 'NMO.GBL.BST.PEN',   // Pendiente de confirmación
  PENDING_CANCELLATION = 'NMO.GBL.BST.CNP',   // Pendiente de cancelación
  REJECTED = 'NMO.GBL.BST.RJT',               // Rechazado
  REQUEST_FAILED = 'NMO.GBL.BST.RQF',         // Falló la solicitud
  PAID = 'NMO.GBL.BST.PAI',                   // Reserva Pagada
}
