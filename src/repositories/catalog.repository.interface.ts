import { QueryAmenitiesDto, QuerySuppliersDto, QueryAccommodationsDto } from '../domain/dtos/query-catalog.dto';
import {
  AccommodationItem,
  AmenityItem,
  BoardTypeItem,
  CatalogItem,
  PaginatedResult,
  RoomTypeItem,
  StarRatingItem,
  SupplierItem,
} from '../domain/models/catalog.model';

/**
 * Token de inyección de dependencias para el repositorio de catálogos.
 * Sigue la convención de desacoplamiento de interfaces establecida en CLAUDE.md.
 */
export const CATALOG_REPOSITORY = Symbol('CATALOG_REPOSITORY');

export interface ICatalogRepository {
  getRoomTypes(): Promise<readonly RoomTypeItem[]>;
  getBoardTypes(): Promise<readonly BoardTypeItem[]>;
  getAmenityGroups(): Promise<readonly CatalogItem[]>;
  getAmenities(query: QueryAmenitiesDto): Promise<PaginatedResult<AmenityItem>>;
  getSuppliers(query: QuerySuppliersDto): Promise<PaginatedResult<SupplierItem>>;
  getAccommodationTypes(query: QueryAccommodationsDto): Promise<PaginatedResult<AccommodationItem>>;
  getBookingStatuses(): Promise<readonly CatalogItem[]>;
  getPassengerDocumentTypes(): Promise<readonly CatalogItem[]>;
  getCancellationFeeTypes(): Promise<readonly CatalogItem[]>;
  getStarRatings(): Promise<readonly StarRatingItem[]>;
}
