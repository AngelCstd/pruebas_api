/**
 * Tipos de calificación / categoría de establecimientos hoteleros.
 * Especificación de la Tabla 7 (Tipos de Estrellas).
 */
export enum HotelRatingType {
  STARS = 'NMO.HTL.RTT.STR',               // Estrellas tradicionales (Hoteles estándar)
  APARTMENT = 'NMO.HTL.RTT.APM',           // Apartamentos
  APARTHOTEL = 'NMO.HTL.RTT.APR',          // Apartahoteles
  BED_AND_BREAKFAST = 'NMO.HTL.RTT.BNB',   // B&B
  BOUTIQUE = 'NMO.HTL.RTT.BTQ',            // Hotel Boutique
  CAMPING = 'NMO.HTL.RTT.CMP',             // Camping
  DIAMONDS = 'NMO.HTL.RTT.DMN',            // Diamantes (Calificación AAA)
  HOSTAL = 'NMO.HTL.RTT.HST',              // Hostales
  KEYS = 'NMO.HTL.RTT.KEY',                // Llaves (Apartamentos turísticos)
  LODGE = 'NMO.HTL.RTT.LDG',               // Lodges
  POUSADA = 'NMO.HTL.RTT.PSD',             // Posadas
  RESIDENCE = 'NMO.HTL.RTT.RES',           // Residencias
  RURAL_HOTEL = 'NMO.HTL.RTT.RRL',         // Hotel Rural
  VILLA = 'NMO.HTL.RTT.VLL',               // Villas
}
