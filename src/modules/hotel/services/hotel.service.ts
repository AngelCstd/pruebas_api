import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CatalogQueryDto } from '../dto/catalog-query.dto';
import { SearchHotelsDto } from '../dto/search-hotels.dto';
import { ProviderType } from '../enums/provider.enum';
import { NemoReadService } from '../infrastructure/nemo/nemo-read.service';
import {
  HotelCatalogItem,
  HotelCatalogResult,
  HotelDestination,
  RoomTypeOption,
} from '../models/hotel-catalog.model';
import { HotelSearchResult } from '../models/hotel.model';
import { MockHotelCatalogRepository } from '../repositories/mock-hotel-catalog.repository';
import { HotelStrategyFactory } from '../strategies/hotel-strategy.factory';

@Injectable()
export class HotelService {
  public constructor(
    private readonly strategyFactory: HotelStrategyFactory,
    private readonly mockCatalogRepository: MockHotelCatalogRepository,
    private readonly nemoReadService: NemoReadService,
  ) {}

  public listCatalog(query: CatalogQueryDto): HotelCatalogResult {
    if (query.provider === ProviderType.NEMO) {
      return this.nemoReadService.listCatalog();
    }
    return this.mockCatalogRepository.findAll(query);
  }

  public getHotelByCode(hotelCode: string, provider: ProviderType): HotelCatalogItem {
    if (provider === ProviderType.NEMO) {
      return this.nemoReadService.getHotelDetail();
    }
    const hotel = this.mockCatalogRepository.findByCode(hotelCode);
    if (!hotel) {
      throw new NotFoundException(`Mock hotel '${hotelCode}' was not found.`);
    }
    return hotel;
  }

  public listDestinations(provider: ProviderType): readonly HotelDestination[] {
    if (provider === ProviderType.NEMO) {
      return this.nemoReadService.listDestinations();
    }
    return this.mockCatalogRepository.listDestinations();
  }

  public listRoomTypes(provider: ProviderType): readonly RoomTypeOption[] {
    if (provider === ProviderType.NEMO) {
      return this.nemoReadService.listRoomTypes();
    }
    return this.mockCatalogRepository.listRoomTypes();
  }

  public searchHotels(
    dto: SearchHotelsDto,
    provider: ProviderType = ProviderType.MOCK,
  ): Promise<HotelSearchResult> {
    this.validateDates(dto.checkIn, dto.checkOut);
    this.validateRoomAssignments(dto);
    return this.strategyFactory.resolve(provider).searchHotels(dto);
  }

  private validateDates(checkIn: string, checkOut: string): void {
    const checkInDate = new Date(`${checkIn}T00:00:00.000Z`);
    const checkOutDate = new Date(`${checkOut}T00:00:00.000Z`);
    if (
      Number.isNaN(checkInDate.getTime())
      || Number.isNaN(checkOutDate.getTime())
      || checkOutDate <= checkInDate
    ) {
      throw new BadRequestException('checkOut must be a valid date after checkIn.');
    }
  }

  private validateRoomAssignments(dto: SearchHotelsDto): void {
    const sequences = new Set(dto.rooms.map((room) => room.roomSequence));
    if (sequences.size !== dto.rooms.length) {
      throw new BadRequestException('Each roomSequence must be unique.');
    }
    if (dto.passengers.some((passenger) => !sequences.has(passenger.roomSequence))) {
      throw new BadRequestException('Every passenger must reference an existing roomSequence.');
    }
    if (dto.rooms.some((room) => !dto.passengers.some(
      (passenger) => passenger.roomSequence === room.roomSequence,
    ))) {
      throw new BadRequestException('Every room must contain at least one passenger.');
    }
  }
}
