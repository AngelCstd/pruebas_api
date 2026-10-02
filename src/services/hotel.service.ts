import { CancelBookingDto } from '../domain/dtos/cancel-booking.dto';
import { BookingDetailResult, BookingCancellationResult } from '../domain/models/booking-lifecycle.model';
import { QueryHotelDetailsDto } from '../domain/dtos/query-hotel-details.dto';
import { QueryHotelCatalogDto } from '../domain/dtos/query-hotel-catalog.dto';
import { BookHotelDto } from '../domain/dtos/book-hotel.dto';
import { HotelDetailsResult } from '../domain/models/hotel-details.model';
import { HotelCatalogResult } from '../domain/models/hotel-catalog.model';
import { BookingListResult, IdempotentBookingResult, ListedBookingStatus } from '../domain/models/booking-operation.model';
import { ValidateRateDto } from '../domain/dtos/validate-rate.dto';
import { CancellationFeesDto } from '../domain/dtos/cancellation-fees.dto';
import { RateValidationResult, CancellationFeesResult } from '../domain/models/rate-lifecycle.model';
import { BadRequestException, Injectable } from '@nestjs/common';
import { SearchHotelsDto } from '../domain/dtos/search-hotels.dto';
import { ProviderType } from '../domain/enums/provider.enum';
import { HotelSearchResult } from '../domain/models/hotel.model';
import { HotelStrategyFactory } from '../strategies/hotel-strategy.factory';
import { BookingApplicationService } from './booking-application.service';

@Injectable()
export class HotelService {
  public constructor(
    private readonly strategyFactory: HotelStrategyFactory,
    private readonly bookings: BookingApplicationService,
  ) {}

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

  public validateRate(dto: ValidateRateDto, provider: ProviderType = ProviderType.MOCK): Promise<RateValidationResult> {
    return this.strategyFactory.resolve(provider).validateRate(dto);
  }

  public getCancellationFees(dto: CancellationFeesDto, provider: ProviderType = ProviderType.MOCK): Promise<CancellationFeesResult> {
    return this.strategyFactory.resolve(provider).getCancellationFees(dto);
  }
  public getHotelDetails(hotelCode: string, dto: QueryHotelDetailsDto, provider: ProviderType = ProviderType.MOCK): Promise<HotelDetailsResult> {
    return this.strategyFactory.resolve(provider).getHotelDetails(hotelCode, dto);
  }

  public getHotelCatalog(dto: QueryHotelCatalogDto, provider: ProviderType = ProviderType.MOCK): Promise<HotelCatalogResult> {
    return this.strategyFactory.resolve(provider).getHotelCatalog(dto);
  }

  public bookHotel(dto: BookHotelDto, provider: ProviderType, idempotencyKey: string | undefined): Promise<IdempotentBookingResult> {
    return this.bookings.bookHotel(dto, provider, idempotencyKey);
  }


  public getBookingDetail(locator: string, provider: ProviderType = ProviderType.MOCK, tenantId?: string): Promise<BookingDetailResult> {
    return this.bookings.getBookingDetail(locator, provider, tenantId);
  }

  public cancelBooking(locator: string, dto: CancelBookingDto, provider: ProviderType = ProviderType.MOCK): Promise<BookingCancellationResult> {
    return this.bookings.cancelBooking(locator, dto, provider);
  }

  public listBookings(provider: ProviderType, limit: number, status?: ListedBookingStatus, tenantId?: string): Promise<BookingListResult> {
    return this.bookings.listBookings(provider, limit, status, tenantId);
  }
}
