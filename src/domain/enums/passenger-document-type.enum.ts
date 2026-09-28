/**
 * Tipos de documentos de identidad para pasajeros en Nemo Group.
 * Especificación de la Tabla 10 (Tipos de Identificadores de Pasajeros).
 */
export enum PassengerDocumentType {
  DNI = 'NMO.HTL.RPT.DNI', // Documento Nacional de Identidad
  PASSPORT = 'NMO.HTL.RPT.PAS', // Pasaporte
  CEDULA = 'NMO.HTL.RPT.CED', // Cédula Mercosur
  CUIL = 'NMO.HTL.RPT.CUI', // Código Único de Identificación Laboral
  CUIT = 'NMO.HTL.RPT.CUT', // Clave Única de Identificación Tributaria
  DRIVING_LICENSE = 'NMO.HTL.RPT.CDL', // Licencia de Conducir
  VISA = 'NMO.HTL.RPT.VIS', // Número de Visa
}
