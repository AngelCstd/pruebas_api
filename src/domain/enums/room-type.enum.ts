/**
 * Tipos de habitación estandarizados por Nemo Group (Price Navigator).
 * Especificación obtenida de la Tabla 9 (Tipos de Habitaciones).
 */
export enum RoomType {
  NMO_HTL_RMT_SGL = 'NMO.HTL.RMT.SGL',         // Simple (1 adulto)
  NMO_HTL_RMT_DBL = 'NMO.HTL.RMT.DBL',         // Doble (2 adultos)
  NMO_HTL_RMT_DBL_TWN = 'NMO.HTL.RMT.DBL.TWN', // Doble Twin (2 camas, 2 adultos)
  NMO_HTL_RMT_DUI = 'NMO.HTL.RMT.DUI',         // Doble uso individual (1 adulto)
  NMO_HTL_RMT_TPL = 'NMO.HTL.RMT.TPL',         // Triple (3 adultos)
  NMO_HTL_RMT_QUA = 'NMO.HTL.RMT.QUA',         // Cuádruple (4 adultos)
  NMO_HTL_RMT_QUD = 'NMO.HTL.RMT.QUD',         // Alias legacy de Cuádruple
  NMO_HTL_RMT_PEN = 'NMO.HTL.RMT.PEN',         // Quíntuple (5 adultos)
  NMO_HTL_RMT_HEX = 'NMO.HTL.RMT.HEX',         // Séxtuple (6 adultos)
  NMO_HTL_RMT_SEP = 'NMO.HTL.RMT.SEP',         // Séptuple (7 adultos)
  NMO_HTL_RMT_OCT = 'NMO.HTL.RMT.OCT',         // Óctuple (8 adultos)
  NMO_HTL_RMT_NON = 'NMO.HTL.RMT.NON',         // Nónuple (9 adultos)
}
