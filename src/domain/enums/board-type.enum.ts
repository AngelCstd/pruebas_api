/**
 * Regímenes de pensión (Board Types) de Nemo Group.
 * Especificación de la Tabla 15.
 */
export enum BoardType {
  ROOM_ONLY = '1',       // Sólo alojamiento
  BED_AND_BREAKFAST = '2', // Sólo desayuno
  LUNCH_ONLY = '3',      // Sólo almuerzo
  DINNER_ONLY = '4',     // Sólo cena
  HALF_BOARD = '5',      // Media Pensión
  FULL_BOARD = '6',      // Pensión Completa
  ALL_INCLUSIVE = '7',   // Todo incluido
  OTHER = '8',           // Otras opciones
  DISNEY_PACKAGES = '9', // Paquetes Disney
}
