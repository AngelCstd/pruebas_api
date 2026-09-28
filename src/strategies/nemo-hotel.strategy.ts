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
import { Injectable } from '@nestjs/common';
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

  public bookHotel(dto: BookHotelDto): Promise<BookingResult> {
    return this.nemoXmlAdapter.bookHotel(dto);
  }


  public getBookingDetail(locator: string): Promise<BookingDetailResult> {
    return this.nemoXmlAdapter.getBookingDetail(locator);
  }

  public cancelBooking(locator: string, dto: CancelBookingDto): Promise<BookingCancellationResult> {
    return this.nemoXmlAdapter.cancelBooking(locator, dto);
  }
}
