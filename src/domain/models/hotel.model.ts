import { ProviderType } from '../enums/provider.enum';

export interface HotelAddress {
  readonly street: string;
  readonly city: string;
  readonly postalCode: string;
  readonly countryCode: string;
}

export interface HotelRoomRate {
  readonly roomSequence: number;
  readonly roomType: string;
  readonly boardCode: string;
  readonly boardDescription: string;
}

export interface HotelCancellationPolicy {
  readonly refundable: boolean;
  readonly deadline?: string;
  /** Aclaración cuando la política no es conocida (p. ej. hoteles de convenio). */
  readonly note?: string;
}

export interface HotelRate {
  readonly tripProductId: string;
  readonly rateClass: string;
  readonly amount: number;
  readonly currency: string;
  readonly roomRates: readonly HotelRoomRate[];
  readonly cancellationPolicy: HotelCancellationPolicy;
  readonly bookable: boolean;
  readonly bookableReason?: 'PENDING_OPERATIONS' | 'PROVIDER_BOOKING_DISABLED';
  readonly bookingNote?: string;
  /** true = el precio ya incluye impuestos (convenio). Ausente = el proveedor no lo informa. */
  readonly taxesIncluded?: boolean;
}

export interface HotelItem {
  readonly hotelCode: string;
  readonly hotelName: string;
  readonly rating: number;
  readonly address: HotelAddress;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly rates: readonly HotelRate[];
  /** De dónde viene el hotel. Solo lo informa la búsqueda combinada (`provider=all`). */
  readonly source?: ProviderType;
}

/** Resultado por fuente en una búsqueda combinada: permite ver si alguna falló sin romper el resto. */
export interface SearchSourceStatus {
  readonly source: ProviderType;
  readonly status: 'OK' | 'ERROR';
  readonly hotels: number;
  readonly message?: string;
}

export interface HotelSearchResult {
  readonly transactionId: string;
  readonly provider: ProviderType;
  readonly totalItems: number;
  readonly hotels: readonly HotelItem[];
  readonly sources?: readonly SearchSourceStatus[];
}
