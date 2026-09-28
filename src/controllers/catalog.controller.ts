import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { QueryAmenitiesDto, QuerySuppliersDto, QueryAccommodationsDto } from '../domain/dtos/query-catalog.dto';
import { Controller, Get, Query } from '@nestjs/common';
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
import { CatalogService } from '../services/catalog.service';

@ApiTags('Catalogs')
@Controller('catalogs')
export class CatalogController {
  public constructor(private readonly catalogService: CatalogService) {}

  @Get('room-types')
  @ApiOperation({ summary: 'List room types' })
  @ApiResponse({ status: 200, description: 'Catalog entries returned successfully.' })
  public getRoomTypes(): Promise<readonly RoomTypeItem[]> {
    return this.catalogService.getRoomTypes();
  }

  @Get('board-types')
  @ApiOperation({ summary: 'List board types' })
  @ApiResponse({ status: 200, description: 'Catalog entries returned successfully.' })
  public getBoardTypes(): Promise<readonly BoardTypeItem[]> {
    return this.catalogService.getBoardTypes();
  }

  @Get('amenity-groups')
  @ApiOperation({ summary: 'List amenity groups' })
  @ApiResponse({ status: 200, description: 'Catalog entries returned successfully.' })
  public getAmenityGroups(): Promise<readonly CatalogItem[]> {
    return this.catalogService.getAmenityGroups();
  }

  @Get('amenities')
  @ApiOperation({ summary: 'List amenities' })
  @ApiResponse({ status: 200, description: 'Catalog entries returned successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid catalog filters or pagination.' })
  @ApiQuery({ name: 'page', type: Number, required: false, example: 1, description: 'Page number (defaults to 1).' })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 20, description: 'Page size, 1–100 (defaults to 20).' })
  @ApiQuery({ name: 'sortOrder', type: String, required: false, example: 'ASC', description: 'Sort direction (ASC or DESC).' })
  @ApiQuery({ name: 'search', type: String, required: false, example: 'Hotel', description: 'Text search.' })
  @ApiQuery({ name: 'codes', type: String, required: false, example: '1,2', description: 'Comma-separated catalog codes.' })
  @ApiQuery({ name: 'groupCode', type: String, required: false, example: 'HTL', description: 'Single amenity group code.' })
  @ApiQuery({ name: 'groupCodes', type: String, required: false, example: 'HTL,ROOM', description: 'Comma-separated amenity group codes.' })
  public getAmenities(@Query() query: QueryAmenitiesDto): Promise<PaginatedResult<AmenityItem>> {
    return this.catalogService.getAmenities(query);
  }

  @Get('suppliers')
  @ApiOperation({ summary: 'List suppliers' })
  @ApiResponse({ status: 200, description: 'Catalog entries returned successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid catalog filters or pagination.' })
  @ApiQuery({ name: 'page', type: Number, required: false, example: 1, description: 'Page number (defaults to 1).' })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 20, description: 'Page size, 1–100 (defaults to 20).' })
  @ApiQuery({ name: 'sortOrder', type: String, required: false, example: 'ASC', description: 'Sort direction (ASC or DESC).' })
  @ApiQuery({ name: 'search', type: String, required: false, example: 'Hotel', description: 'Text search.' })
  @ApiQuery({ name: 'codes', type: String, required: false, example: '1,2', description: 'Comma-separated catalog codes.' })
  public getSuppliers(@Query() query: QuerySuppliersDto): Promise<PaginatedResult<SupplierItem>> {
    return this.catalogService.getSuppliers(query);
  }

  @Get('accommodation-types')
  @ApiOperation({ summary: 'List accommodation types' })
  @ApiResponse({ status: 200, description: 'Catalog entries returned successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid catalog filters or pagination.' })
  @ApiQuery({ name: 'page', type: Number, required: false, example: 1, description: 'Page number (defaults to 1).' })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 20, description: 'Page size, 1–100 (defaults to 20).' })
  @ApiQuery({ name: 'sortOrder', type: String, required: false, example: 'ASC', description: 'Sort direction (ASC or DESC).' })
  @ApiQuery({ name: 'search', type: String, required: false, example: 'Hotel', description: 'Text search.' })
  @ApiQuery({ name: 'codes', type: String, required: false, example: '1,2', description: 'Comma-separated catalog codes.' })
  public getAccommodationTypes(
    @Query() query: QueryAccommodationsDto,
  ): Promise<PaginatedResult<AccommodationItem>> {
    return this.catalogService.getAccommodationTypes(query);
  }

  @Get('booking-statuses')
  @ApiOperation({ summary: 'List booking statuses' })
  @ApiResponse({ status: 200, description: 'Catalog entries returned successfully.' })
  public getBookingStatuses(): Promise<readonly CatalogItem[]> {
    return this.catalogService.getBookingStatuses();
  }

  @Get('passenger-document-types')
  @ApiOperation({ summary: 'List passenger document types' })
  @ApiResponse({ status: 200, description: 'Catalog entries returned successfully.' })
  public getPassengerDocumentTypes(): Promise<readonly CatalogItem[]> {
    return this.catalogService.getPassengerDocumentTypes();
  }

  @Get('cancellation-fee-types')
  @ApiOperation({ summary: 'List cancellation fee types' })
  @ApiResponse({ status: 200, description: 'Catalog entries returned successfully.' })
  public getCancellationFeeTypes(): Promise<readonly CatalogItem[]> {
    return this.catalogService.getCancellationFeeTypes();
  }

  @Get('star-ratings')
  @ApiOperation({ summary: 'List star ratings' })
  @ApiResponse({ status: 200, description: 'Catalog entries returned successfully.' })
  public getStarRatings(): Promise<readonly StarRatingItem[]> {
    return this.catalogService.getStarRatings();
  }
}
