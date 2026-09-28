/**
 * Tipos de destinos geográficos en Nemo Group.
 * Especificación de la Tabla 6 (Tipos de Destinos).
 */
export enum DestinationType {
  CITY = 'NMO.HTL.DST.CTY',            // Ciudad
  AIRPORT = 'NMO.HTL.DST.AIR',         // Aeropuerto
  AREA = 'NMO.HTL.DST.ARE',            // Área / Zona
  HOTELBEDS_CITY = 'NMO.HTL.DST.CHB',  // Ciudad código HotelBeds
  HOTELBEDS_ZONE = 'NMO.HTL.DST.ZHB',  // Zona código HotelBeds
  COUNTRY = 'NMO.HTL.DST.CTR',         // País
  PORT = 'NMO.HTL.DST.PRT',            // Puerto marítimo
  BUS_STATION = 'NMO.HTL.DST.BUS',     // Estación de autobuses
  TRAIN_STATION = 'NMO.HTL.DST.TRS',   // Estación de tren
}
