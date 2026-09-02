import { BadRequestException, Injectable } from '@nestjs/common';
import { SearchHotelsDto } from '../domain/dtos/search-hotels.dto';
import { ProviderType } from '../domain/enums/provider.enum';
import { HotelSearchResult } from '../domain/models/hotel.model';
import { HotelStrategyFactory } from '../strategies/hotel-strategy.factory';

@Injectable()
export class HotelService {
  public constructor(private readonly strategyFactory: HotelStrategyFactory) {}

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
