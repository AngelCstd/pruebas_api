import { CancelBookingDto } from '../domain/dtos/cancel-booking.dto';
import { BookingDetailResult, BookingCancellationResult } from '../domain/models/booking-lifecycle.model';
import { QueryHotelDetailsDto } from '../domain/dtos/query-hotel-details.dto';
import { QueryHotelCatalogDto } from '../domain/dtos/query-hotel-catalog.dto';
import { BookHotelDto } from '../domain/dtos/book-hotel.dto';
import { HotelDetailsResult } from '../domain/models/hotel-details.model';
import { HotelCatalogResult } from '../domain/models/hotel-catalog.model';
import { BookingResult } from '../domain/models/booking.model';
import { ValidateRateDto } from '../domain/dtos/validate-rate.dto';
import { CancellationFeesDto } from '../domain/dtos/cancellation-fees.dto';
import { RateValidationResult, CancellationFeesResult } from '../domain/models/rate-lifecycle.model';
import { HttpException, Injectable } from '@nestjs/common';
import { NemoXmlAdapter } from '../adapters/nemo/nemo-xml.adapter';
import { SearchHotelsDto } from '../domain/dtos/search-hotels.dto';
import { HotelSearchResult } from '../domain/models/hotel.model';
import { HotelProviderStrategy } from './hotel-provider.strategy';

@Injectable()
export class NemoHotelStrategy implements HotelProviderStrategy {
  public constructor(private readonly nemoXmlAdapter: NemoXmlAdapter) {}

  public searchHotels(dto: SearchHotelsDto): Promise<HotelSearchResult> {
    return this.nemoXmlAdapter.searchHotels(dto);
  }

  public validateRate(dto: ValidateRateDto): Promise<RateValidationResult> {
    return this.nemoXmlAdapter.validateRate(dto);
  }

  public getCancellationFees(dto: CancellationFeesDto): Promise<CancellationFeesResult> {
    return this.nemoXmlAdapter.getCancellationFees(dto);
  }
  public getHotelDetails(hotelCode: string, dto: QueryHotelDetailsDto): Promise<HotelDetailsResult> {
    return this.nemoXmlAdapter.getHotelDetails(hotelCode, dto);
  }

  public getHotelCatalog(dto: QueryHotelCatalogDto): Promise<HotelCatalogResult> {
    return this.nemoXmlAdapter.getHotelCatalog(dto);
  }

  public bookHotel(_dto: BookHotelDto): Promise<BookingResult> {
    throw this.bookingDisabled();
  }


  public getBookingDetail(_locator: string): Promise<BookingDetailResult> {
    throw this.bookingDisabled();
  }

  public cancelBooking(_locator: string, _dto: CancelBookingDto): Promise<BookingCancellationResult> {
    throw this.bookingDisabled();
  }

  private bookingDisabled(): HttpException {
    return new HttpException({
      statusCode: 501, message: 'Booking Nemo hotels is not enabled.',
      error: 'Not Implemented', code: 'BOOKING_NOT_ENABLED',
    }, 501);
  }
}
