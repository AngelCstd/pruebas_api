/**
 * Grupos principales de instalaciones y servicios del hotel.
 * Especificación de la Tabla 1 (Grupos de Servicios e Instalaciones).
 */
export enum AmenityGroup {
  CATERING = 'NMO.HTL.AMT.CAT', // Restauración
  SERVICES = 'MNO.HTL.AMT.SER',         // Servicios generales (sábanas, toallas, etc.)
  BEACH = 'NMO.HTL.AMT.BCH',            // Instalaciones de playa
  DISTANCE = 'NMO.HTL.AMT.DST',         // Distancias de referencia (en metros)
  FACILITIES = 'NMO.HTL.AMT.FCL',       // Instalaciones del hotel
  FREE_SERVICES = 'NMO.HTL.AMT.FSE',    // Servicios gratuitos
  HOTEL = 'NMO.HTL.AMT.HTL',            // Características de hotel
  ROOM = 'NMO.HTL.AMT.HTR',             // Equipamiento de habitación
  HOTEL_TYPE = 'NMO.HTL.AMT.HTT',       // Tipo de hotel
  LOCATION = 'NMO.HTL.AMT.LOC',         // Ubicación
  PAYMENT_METHODS = 'NMO.HTL.AMT.MOP',  // Medios de pago aceptados
  POINTS_OF_INTEREST = 'NMO.HTL.AMT.POI', // Puntos de interés cercanos
  PAID_SERVICES = 'NMO.HTL.AMT.PSE',    // Servicios de pago adicional
  SPORT = 'NMO.HTL.AMT.SPO',            // Instalaciones y actividades deportivas
}
