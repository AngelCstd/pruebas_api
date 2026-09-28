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
import { SearchHotelsDto } from '../domain/dtos/search-hotels.dto';
import { HotelSearchResult } from '../domain/models/hotel.model';

export interface HotelProviderStrategy {
  validateRate(dto: ValidateRateDto): Promise<RateValidationResult>;
  getCancellationFees(dto: CancellationFeesDto): Promise<CancellationFeesResult>;
  searchHotels(dto: SearchHotelsDto): Promise<HotelSearchResult>;
  getHotelDetails(hotelCode: string, dto: QueryHotelDetailsDto): Promise<HotelDetailsResult>;
  getHotelCatalog(dto: QueryHotelCatalogDto): Promise<HotelCatalogResult>;
  getBookingDetail(locator: string): Promise<BookingDetailResult>;
  cancelBooking(locator: string, dto: CancelBookingDto): Promise<BookingCancellationResult>;
  bookHotel(dto: BookHotelDto): Promise<BookingResult>;

}
