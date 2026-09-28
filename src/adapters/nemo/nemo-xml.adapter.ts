import { CancelBookingDto } from '../../domain/dtos/cancel-booking.dto';
import { BookingDetailResult, BookingCancellationResult } from '../../domain/models/booking-lifecycle.model';
import { QueryHotelDetailsDto } from '../../domain/dtos/query-hotel-details.dto';
import { QueryHotelCatalogDto } from '../../domain/dtos/query-hotel-catalog.dto';
import { BookHotelDto } from '../../domain/dtos/book-hotel.dto';
import { HotelDetailsResult } from '../../domain/models/hotel-details.model';
import { HotelCatalogResult } from '../../domain/models/hotel-catalog.model';
import { BookingResult } from '../../domain/models/booking.model';
import { ValidateRateDto } from '../../domain/dtos/validate-rate.dto';
import { CancellationFeesDto } from '../../domain/dtos/cancellation-fees.dto';
import { RateValidationResult, CancellationFeesResult } from '../../domain/models/rate-lifecycle.model';
import {
  BadGatewayException,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import axios from 'axios';
import { SearchHotelsDto } from '../../domain/dtos/search-hotels.dto';
import { HotelSearchResult } from '../../domain/models/hotel.model';
import { NemoXmlBuilder } from './nemo-xml.builder';
import { NemoXmlParser } from './nemo-xml.parser';

@Injectable()
export class NemoXmlAdapter {
  private readonly defaultBaseUrl = 'https://service-cert.psurfer.net/pricesurfer';

  public constructor(
    private readonly builder: NemoXmlBuilder,
    private readonly parser: NemoXmlParser,
  ) {}

  public async searchHotels(dto: SearchHotelsDto): Promise<HotelSearchResult> {
    const transactionId = this.createTransactionId();
    const xml = this.builder.buildAvailabilityRequest(dto, transactionId);
    return this.send('/catalog/products/search', xml, (body) =>
      this.parser.parseAvailabilityResponse(body, transactionId));
  }

  public validateRate(dto: ValidateRateDto): Promise<RateValidationResult> {
    const transactionId = this.createTransactionId();
    return this.send('/catalog/product/validate', this.builder.buildValidationRequest(dto, transactionId),
      (body) => this.parser.parseValidationResponse(body, transactionId));
  }

  public getCancellationFees(dto: CancellationFeesDto): Promise<CancellationFeesResult> {
    const transactionId = this.createTransactionId();
    return this.send('/booking/cancellation/fees', this.builder.buildCancellationFeesRequest(dto, transactionId),
      (body) => this.parser.parseCancellationFeesResponse(body, transactionId));
  }

  private async send<T>(endpoint: string, xml: string, parse: (body: string) => T): Promise<T> {
    const baseUrl = (process.env.NEMO_BASE_URL ?? this.defaultBaseUrl).replace(/\/+$/, '');
    const authToken = process.env.NEMO_AUTH_TOKEN ?? '';

    try {
      const response = await axios.post<string>(`${baseUrl}${endpoint}`, xml, {
        headers: {
          'Content-Type': 'application/xml',
          Accept: 'application/xml',
          'X-PS-AUTHTOKEN': authToken,
          'Accept-Encoding': 'gzip',
        },
        responseType: 'text',
        timeout: 15_000,
        transformResponse: [(body: string): string => body],
      });
      return parse(response.data);
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          throw new UnauthorizedException('Authentication with hotel supplier failed.');
        }
        const status = error.response?.status;
        const suffix = status ? ` (HTTP ${status})` : '';
        throw new BadGatewayException(`Unable to complete the Nemo hotel request${suffix}.`);
      }
      throw new BadGatewayException('Nemo returned an invalid hotel request response.');
    }
  }

  private createTransactionId(): string {
    const timestamp = Date.now();
    const random = Math.floor(100_000 + Math.random() * 900_000);
    return `TX_NEMO_${timestamp}_${random}`;
  }
  public getHotelDetails(hotelCode: string, dto: QueryHotelDetailsDto): Promise<HotelDetailsResult> {
    const transactionId = this.createTransactionId();
    return this.send('/catalog/product/detail', this.builder.buildHotelDetailsRequest(hotelCode, dto, transactionId),
      (body) => this.parser.parseHotelDetailsResponse(body));
  }

  public getHotelCatalog(dto: QueryHotelCatalogDto): Promise<HotelCatalogResult> {
    const transactionId = this.createTransactionId();
    return this.send('/catalog/hotels/list', this.builder.buildHotelCatalogRequest(dto, transactionId),
      (body) => this.parser.parseHotelCatalogResponse(body));
  }

  public bookHotel(dto: BookHotelDto): Promise<BookingResult> {
    const transactionId = this.createTransactionId();
    return this.send('/catalog/product/book', this.builder.buildBookingRequest(dto, transactionId),
      (body) => this.parser.parseBookingResponse(body));
  }


  public getBookingDetail(locator: string): Promise<BookingDetailResult> {
    const transactionId = this.createTransactionId();
    return this.send('/booking/detail', this.builder.buildBookingDetailRequest(locator, transactionId),
      (body) => this.parser.parseBookingDetailResponse(body));
  }

  public cancelBooking(locator: string, dto: CancelBookingDto): Promise<BookingCancellationResult> {
    const transactionId = this.createTransactionId();
    return this.send('/booking/cancel', this.builder.buildBookingCancellationRequest(locator, dto, transactionId),
      (body) => this.parser.parseBookingCancellationResponse(body));
  }
}
