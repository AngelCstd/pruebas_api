import { QueryAmenitiesDto, QuerySuppliersDto, QueryAccommodationsDto } from '../domain/dtos/query-catalog.dto';
import { Inject, Injectable } from '@nestjs/common';
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
import {
  CATALOG_REPOSITORY,
  ICatalogRepository,
} from '../repositories/catalog.repository.interface';

@Injectable()
export class CatalogService {
  public constructor(
    @Inject(CATALOG_REPOSITORY)
    private readonly catalogRepository: ICatalogRepository,
  ) {}

  public getRoomTypes(): Promise<readonly RoomTypeItem[]> {
    return this.catalogRepository.getRoomTypes();
  }

  public getBoardTypes(): Promise<readonly BoardTypeItem[]> {
    return this.catalogRepository.getBoardTypes();
  }

  public getAmenityGroups(): Promise<readonly CatalogItem[]> {
    return this.catalogRepository.getAmenityGroups();
  }

  public getAmenities(query: QueryAmenitiesDto): Promise<PaginatedResult<AmenityItem>> {
    return this.catalogRepository.getAmenities(query);
  }

  public getSuppliers(query: QuerySuppliersDto): Promise<PaginatedResult<SupplierItem>> {
    return this.catalogRepository.getSuppliers(query);
  }

  public getAccommodationTypes(query: QueryAccommodationsDto): Promise<PaginatedResult<AccommodationItem>> {
    return this.catalogRepository.getAccommodationTypes(query);
  }

  public getBookingStatuses(): Promise<readonly CatalogItem[]> {
    return this.catalogRepository.getBookingStatuses();
  }

  public getPassengerDocumentTypes(): Promise<readonly CatalogItem[]> {
    return this.catalogRepository.getPassengerDocumentTypes();
  }

  public getCancellationFeeTypes(): Promise<readonly CatalogItem[]> {
    return this.catalogRepository.getCancellationFeeTypes();
  }

  public getStarRatings(): Promise<readonly StarRatingItem[]> {
    return this.catalogRepository.getStarRatings();
  }
}
