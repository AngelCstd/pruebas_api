import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
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
import { Body, Get, Param, HttpCode, Controller, DefaultValuePipe, ParseEnumPipe, Post, Query } from '@nestjs/common';
import { SearchHotelsDto } from '../domain/dtos/search-hotels.dto';
import { ProviderType } from '../domain/enums/provider.enum';
import { HotelSearchResult } from '../domain/models/hotel.model';
import { HotelService } from '../services/hotel.service';

@ApiTags('Hotels')
@Controller('hotels')
export class HotelController {
  public constructor(private readonly hotelService: HotelService) {}

  @Post('search')
  @ApiOperation({ summary: 'Search hotel availability' })
  @ApiResponse({ status: 201, description: 'Search hotel availability result.' })
  @ApiResponse({ status: 400, description: 'Invalid request parameters or payload.' })
  @ApiResponse({ status: 401, description: 'Supplier authentication failed.' })
  @ApiResponse({ status: 502, description: 'Supplier request failed or returned an invalid response.' })
  @ApiResponse({ status: 409, description: 'Rate price changed upstream.' })
  @ApiResponse({ status: 500, description: 'Unrecognized supplier error.' })
  @ApiQuery({ name: 'provider', required: false, enum: ProviderType, example: ProviderType.MOCK, description: 'Hotel provider (defaults to mock).' })
  public searchHotels(
    @Body() dto: SearchHotelsDto,
    @Query('provider', new DefaultValuePipe(ProviderType.MOCK), new ParseEnumPipe(ProviderType))
    provider: ProviderType,
  ): Promise<HotelSearchResult> {
    return this.hotelService.searchHotels(dto, provider);
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validate a hotel rate' })
  @ApiResponse({ status: 200, description: 'Validate a hotel rate result.' })
  @ApiResponse({ status: 400, description: 'Invalid request parameters or payload.' })
  @ApiResponse({ status: 401, description: 'Supplier authentication failed.' })
  @ApiResponse({ status: 502, description: 'Supplier request failed or returned an invalid response.' })
  @ApiResponse({ status: 409, description: 'Rate price changed upstream.' })
  @ApiResponse({ status: 500, description: 'Unrecognized supplier error.' })
  @ApiQuery({ name: 'provider', required: false, enum: ProviderType, example: ProviderType.MOCK, description: 'Hotel provider (defaults to mock).' })
  @ApiResponse({ status: 404, description: 'Rate not found.' })
  @ApiResponse({ status: 410, description: 'Rate session expired; repeat the search.' })
  @HttpCode(200)
  public validateRate(
    @Body() dto: ValidateRateDto,
    @Query('provider', new DefaultValuePipe(ProviderType.MOCK), new ParseEnumPipe(ProviderType))
    provider: ProviderType,
  ): Promise<RateValidationResult> {
    return this.hotelService.validateRate(dto, provider);
  }

  @Post('cancellation-fees')
  @ApiOperation({ summary: 'Get cancellation fees for a rate' })
  @ApiResponse({ status: 200, description: 'Get cancellation fees for a rate result.' })
  @ApiResponse({ status: 400, description: 'Invalid request parameters or payload.' })
  @ApiResponse({ status: 401, description: 'Supplier authentication failed.' })
  @ApiResponse({ status: 502, description: 'Supplier request failed or returned an invalid response.' })
  @ApiResponse({ status: 409, description: 'Rate price changed upstream.' })
  @ApiResponse({ status: 500, description: 'Unrecognized supplier error.' })
  @ApiQuery({ name: 'provider', required: false, enum: ProviderType, example: ProviderType.MOCK, description: 'Hotel provider (defaults to mock).' })
  @ApiResponse({ status: 404, description: 'Rate not found.' })
  @ApiResponse({ status: 410, description: 'Rate session expired; repeat the search.' })
  @HttpCode(200)
  public getCancellationFees(
    @Body() dto: CancellationFeesDto,
    @Query('provider', new DefaultValuePipe(ProviderType.MOCK), new ParseEnumPipe(ProviderType))
    provider: ProviderType,
  ): Promise<CancellationFeesResult> {
    return this.hotelService.getCancellationFees(dto, provider);
  }
  @Get('catalog')
  @ApiOperation({ summary: 'List hotels at a destination' })
  @ApiResponse({ status: 200, description: 'List hotels at a destination result.' })
  @ApiResponse({ status: 400, description: 'Invalid request parameters or payload.' })
  @ApiResponse({ status: 401, description: 'Supplier authentication failed.' })
  @ApiResponse({ status: 502, description: 'Supplier request failed or returned an invalid response.' })
  @ApiResponse({ status: 409, description: 'Rate price changed upstream.' })
  @ApiResponse({ status: 500, description: 'Unrecognized supplier error.' })
  @ApiQuery({ name: 'provider', required: false, enum: ProviderType, example: ProviderType.MOCK, description: 'Hotel provider (defaults to mock).' })
  @ApiQuery({ name: 'destinationCode', type: String, required: true, example: '2262', description: 'Provider destination code.' })
  @ApiQuery({ name: 'activeOnly', type: Boolean, required: false, example: true, description: 'Only include active hotels (defaults to true).' })
  public getHotelCatalog(@Query() dto: QueryHotelCatalogDto): Promise<HotelCatalogResult> {
    return this.hotelService.getHotelCatalog(dto, dto.provider);
  }

  @Get(':hotelCode/details')
  @ApiOperation({ summary: 'Get hotel details' })
  @ApiResponse({ status: 200, description: 'Get hotel details result.' })
  @ApiResponse({ status: 400, description: 'Invalid request parameters or payload.' })
  @ApiResponse({ status: 401, description: 'Supplier authentication failed.' })
  @ApiResponse({ status: 502, description: 'Supplier request failed or returned an invalid response.' })
  @ApiResponse({ status: 409, description: 'Rate price changed upstream.' })
  @ApiResponse({ status: 500, description: 'Unrecognized supplier error.' })
  @ApiQuery({ name: 'provider', required: false, enum: ProviderType, example: ProviderType.MOCK, description: 'Hotel provider (defaults to mock).' })
  @ApiParam({ name: 'hotelCode', type: String, example: 'MOCK-2262-001', description: 'Provider hotel code.' })
  @ApiQuery({ name: 'language', type: String, required: false, example: 'es', description: 'Content language (defaults to es).' })
  @ApiResponse({ status: 404, description: 'Hotel not found.' })
  public getHotelDetails(@Param('hotelCode') hotelCode: string, @Query() dto: QueryHotelDetailsDto): Promise<HotelDetailsResult> {
    return this.hotelService.getHotelDetails(hotelCode, dto, dto.provider);
  }

  /* Booking is intentionally disabled in this repository.
   * When moving repositories or activating production, configure Nemo credentials
   * and credit-limit payment access, verify the supplier booking contract, then
   * remove this block comment to register POST /hotels/book. Review authentication
   * and duplicate-submission handling before exposing this committing operation.
  @Post('book')
  public bookHotel(
    @Body() dto: BookHotelDto,
    @Query('provider', new DefaultValuePipe(ProviderType.MOCK), new ParseEnumPipe(ProviderType))
    provider: ProviderType,
  ): Promise<BookingResult> {
    return this.hotelService.bookHotel(dto, provider);
  }
  */

  /* Booking detail and cancellation routes are intentionally disabled.
   * When changing repository / production credentials, configure NEMO_BASE_URL
   * and NEMO_AUTH_TOKEN, verify the supplier lifecycle XML contract and permissions,
   * enforce booking ownership and the 10 requests / 10 seconds supplier limit,
   * then remove this block comment to activate these two handlers.
  @Get('bookings/:locator')
  public getBookingDetail(
    @Param('locator') locator: string,
    @Query('provider', new DefaultValuePipe(ProviderType.MOCK), new ParseEnumPipe(ProviderType))
    provider: ProviderType,
  ): Promise<BookingDetailResult> {
    return this.hotelService.getBookingDetail(locator, provider);
  }

  @Post('bookings/:locator/cancel')
  @HttpCode(200)
  public cancelBooking(
    @Param('locator') locator: string,
    @Body() dto: CancelBookingDto,
    @Query('provider', new DefaultValuePipe(ProviderType.MOCK), new ParseEnumPipe(ProviderType))
    provider: ProviderType,
  ): Promise<BookingCancellationResult> {
    return this.hotelService.cancelBooking(locator, dto, provider);
  }
  */
}
