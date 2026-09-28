export interface PaginatedResult<T> {
  readonly data: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
}

/**
 * Representa un ítem básico de catálogo con código y descripción.
 */
export interface CatalogItem<T = string> {
  readonly code: T;
  readonly label: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Representa una amenidad / servicio detallado de hotel.
 */
export interface AmenityItem {
  readonly groupCode: string;
  readonly code: string;
  readonly description: string;
}

/**
 * Representa un mayorista / proveedor de inventario (e.g. Hotelbeds, Expedia).
 */
export interface SupplierItem {
  readonly code: string;
  readonly name: string;
}

/**
 * Representa un tipo de alojamiento (e.g. Hotel, Resort, Apartamento).
 */
export interface AccommodationItem {
  readonly code: string;
  readonly description: string;
}

/**
 * Representa un tipo de habitación con su ocupación máxima recomendada de adultos.
 */
export interface RoomTypeItem {
  readonly code: string;
  readonly description: string;
  readonly maxAdults: number;
}

/**
 * Representa un régimen de comidas / pensión alimenticia.
 */
export interface BoardTypeItem {
  readonly code: string;
  readonly description: string;
}

/**
 * Mapeo de calificación de estrellas a su valor numérico decimal.
 */
export interface StarRatingItem {
  readonly categoryType: string;
  readonly code: string;
  readonly numericValue: number;
}
