import { AmenityGroup } from '../enums/amenity-group.enum';
import { BoardType } from '../enums/board-type.enum';
import { BookingStatus } from '../enums/booking-status.enum';
import { CancellationFeeType } from '../enums/cancellation-fee-type.enum';
import { HotelRatingType } from '../enums/hotel-rating-type.enum';
import { PassengerDocumentType } from '../enums/passenger-document-type.enum';
import { RoomType } from '../enums/room-type.enum';
import { BoardTypeItem, CatalogItem, RoomTypeItem } from '../models/catalog.model';

export const ROOM_TYPES_CATALOG: readonly RoomTypeItem[] = [
  { code: RoomType.NMO_HTL_RMT_SGL, description: 'Habitación simple', maxAdults: 1 },
  { code: RoomType.NMO_HTL_RMT_DBL, description: 'Habitación doble', maxAdults: 2 },
  { code: RoomType.NMO_HTL_RMT_DBL_TWN, description: 'Habitación doble twin (2 camas)', maxAdults: 2 },
  { code: RoomType.NMO_HTL_RMT_DUI, description: 'Habitación doble de uso individual', maxAdults: 1 },
  { code: RoomType.NMO_HTL_RMT_TPL, description: 'Habitación triple', maxAdults: 3 },
  { code: RoomType.NMO_HTL_RMT_QUA, description: 'Habitación cuádruple', maxAdults: 4 },
  { code: RoomType.NMO_HTL_RMT_QUD, description: 'Habitación cuádruple (alias)', maxAdults: 4 },
  { code: RoomType.NMO_HTL_RMT_PEN, description: 'Habitación quíntuple', maxAdults: 5 },
  { code: RoomType.NMO_HTL_RMT_HEX, description: 'Habitación séxtuple', maxAdults: 6 },
  { code: RoomType.NMO_HTL_RMT_SEP, description: 'Habitación séptuple', maxAdults: 7 },
  { code: RoomType.NMO_HTL_RMT_OCT, description: 'Habitación óctuple', maxAdults: 8 },
  { code: RoomType.NMO_HTL_RMT_NON, description: 'Habitación nónuple', maxAdults: 9 },
];

export const BOARD_TYPES_CATALOG: readonly BoardTypeItem[] = [
  { code: BoardType.ROOM_ONLY, description: 'Sólo alojamiento' },
  { code: BoardType.BED_AND_BREAKFAST, description: 'Sólo desayuno' },
  { code: BoardType.LUNCH_ONLY, description: 'Sólo almuerzo' },
  { code: BoardType.DINNER_ONLY, description: 'Sólo cena' },
  { code: BoardType.HALF_BOARD, description: 'Media Pensión' },
  { code: BoardType.FULL_BOARD, description: 'Pensión Completa' },
  { code: BoardType.ALL_INCLUSIVE, description: 'Todo incluido' },
  { code: BoardType.OTHER, description: 'Otras opciones' },
  { code: BoardType.DISNEY_PACKAGES, description: 'Paquetes Disney' },
];

export const AMENITY_GROUPS_CATALOG: readonly CatalogItem<AmenityGroup>[] = [
  { code: AmenityGroup.CATERING, label: 'Restauración' },
  { code: AmenityGroup.SERVICES, label: 'Servicios' },
  { code: AmenityGroup.BEACH, label: 'Playa' },
  { code: AmenityGroup.DISTANCE, label: 'Distancia (en metros)' },
  { code: AmenityGroup.FACILITIES, label: 'Instalaciones' },
  { code: AmenityGroup.FREE_SERVICES, label: 'Servicios Gratuitos' },
  { code: AmenityGroup.HOTEL, label: 'Hotel' },
  { code: AmenityGroup.ROOM, label: 'Habitación' },
  { code: AmenityGroup.HOTEL_TYPE, label: 'Tipo de Hotel' },
  { code: AmenityGroup.LOCATION, label: 'Ubicación' },
  { code: AmenityGroup.PAYMENT_METHODS, label: 'Posibilidades de Pago' },
  { code: AmenityGroup.POINTS_OF_INTEREST, label: 'Puntos de Interés' },
  { code: AmenityGroup.PAID_SERVICES, label: 'Servicios Pagos' },
  { code: AmenityGroup.SPORT, label: 'Deporte' },
];

export const BOOKING_STATUSES_CATALOG: readonly CatalogItem<BookingStatus>[] = [
  { code: BookingStatus.CONFIRMED, label: 'Confirmada' },
  { code: BookingStatus.CANCELLED, label: 'Cancelada' },
  { code: BookingStatus.CANCELLED_WITH_CHARGES, label: 'Cancelada con Cargos Adicionales' },
  { code: BookingStatus.CANCEL_FAILED, label: 'Error en la cancelación (Contacte Soporte)' },
  { code: BookingStatus.PENDING_CONFIRMATION, label: 'Pendiente de confirmación' },
  { code: BookingStatus.PENDING_CANCELLATION, label: 'Pendiente de cancelación' },
  { code: BookingStatus.REJECTED, label: 'Rechazado' },
  { code: BookingStatus.REQUEST_FAILED, label: 'Falló la solicitud' },
  { code: BookingStatus.PAID, label: 'Reserva Pagada' },
];

export const PASSENGER_DOCUMENT_TYPES_CATALOG: readonly CatalogItem<PassengerDocumentType>[] = [
  { code: PassengerDocumentType.DNI, label: 'DNI / Documento Nacional' },
  { code: PassengerDocumentType.PASSPORT, label: 'Pasaporte' },
  { code: PassengerDocumentType.CEDULA, label: 'Cédula de Identidad' },
  { code: PassengerDocumentType.CUIL, label: 'CUIL' },
  { code: PassengerDocumentType.CUIT, label: 'CUIT' },
  { code: PassengerDocumentType.DRIVING_LICENSE, label: 'Licencia de Conducir' },
  { code: PassengerDocumentType.VISA, label: 'Número de Visa' },
];

export const CANCELLATION_FEE_TYPES_CATALOG: readonly CatalogItem<CancellationFeeType>[] = [
  { code: CancellationFeeType.CANCELLATION, label: 'Gasto por Cancelación' },
  { code: CancellationFeeType.NO_SHOW, label: 'Gasto por No Presentado (No Show)' },
  { code: CancellationFeeType.MODIFICATION, label: 'Gasto por Modificación' },
];

export const HOTEL_RATING_TYPES_CATALOG: readonly CatalogItem<HotelRatingType>[] = [
  { code: HotelRatingType.STARS, label: 'Estrellas' },
  { code: HotelRatingType.APARTMENT, label: 'Apartamentos' },
  { code: HotelRatingType.APARTHOTEL, label: 'Apartahotel' },
  { code: HotelRatingType.BED_AND_BREAKFAST, label: 'Bed & Breakfast' },
  { code: HotelRatingType.BOUTIQUE, label: 'Boutique' },
  { code: HotelRatingType.CAMPING, label: 'Camping' },
  { code: HotelRatingType.DIAMONDS, label: 'Diamantes' },
  { code: HotelRatingType.HOSTAL, label: 'Hostal' },
  { code: HotelRatingType.KEYS, label: 'Llaves' },
  { code: HotelRatingType.LODGE, label: 'Lodge' },
  { code: HotelRatingType.POUSADA, label: 'Posada / Pousada' },
  { code: HotelRatingType.RESIDENCE, label: 'Residencia' },
  { code: HotelRatingType.RURAL_HOTEL, label: 'Hotel Rural' },
  { code: HotelRatingType.VILLA, label: 'Villa' },
];
