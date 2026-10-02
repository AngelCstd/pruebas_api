import { BadRequestException, HttpException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ProviderType } from '../domain/enums/provider.enum';
import { CancelBookingDto } from '../domain/dtos/cancel-booking.dto';
import { BookHotelDto } from '../domain/dtos/book-hotel.dto';
import { CancellationFeesDto } from '../domain/dtos/cancellation-fees.dto';
import { QueryHotelCatalogDto } from '../domain/dtos/query-hotel-catalog.dto';
import { QueryHotelDetailsDto } from '../domain/dtos/query-hotel-details.dto';
import { SearchHotelsDto } from '../domain/dtos/search-hotels.dto';
import { ValidateRateDto } from '../domain/dtos/validate-rate.dto';
import { BookingCancellationResult, BookingDetailResult } from '../domain/models/booking-lifecycle.model';
import { BookingResult } from '../domain/models/booking.model';
import { HotelCatalogResult } from '../domain/models/hotel-catalog.model';
import { HotelDetailsResult } from '../domain/models/hotel-details.model';
import { HotelSearchResult, SearchSourceStatus } from '../domain/models/hotel.model';
import { CancellationFeesResult, RateValidationResult } from '../domain/models/rate-lifecycle.model';
import { CONVENIO_HOTEL_CODE_PREFIX, CONVENIO_RATE_PREFIX, ConvenioHotelStrategy } from './convenio-hotel.strategy';
import { HotelProviderStrategy } from './hotel-provider.strategy';
import { MockHotelStrategy } from './mock-hotel.strategy';
import { NemoHotelStrategy } from './nemo-hotel.strategy';

const BOOKING_UNAVAILABLE = 'Booking is not available with provider=all; use the provider of the selected rate.';

/**
 * Búsqueda combinada (`provider=all`): proveedor externo + hoteles con convenio.
 *
 * El proveedor externo es `mock` mientras Nemo no esté operativo; se cambia a Nemo con
 * HOTEL_EXTERNAL_PROVIDER=nemo. Si una fuente falla, las demás siguen y el resultado lo informa
 * en `sources`. Las operaciones sobre una tarifa o un hotel se enrutan por el prefijo de su id.
 * Reservar con `all` no se permite: la reserva siempre se hace contra la fuente de la tarifa.
 */
@Injectable()
export class CompositeHotelStrategy implements HotelProviderStrategy {
  public constructor(
    private readonly mock: MockHotelStrategy,
    private readonly nemo: NemoHotelStrategy,
    private readonly convenio: ConvenioHotelStrategy,
  ) {}

  public async searchHotels(dto: SearchHotelsDto): Promise<HotelSearchResult> {
    const external = this.external();
    // Convenio primero: son los hoteles propios.
    const sources: ReadonlyArray<{ type: ProviderType; strategy: HotelProviderStrategy }> = [
      { type: ProviderType.CONVENIO, strategy: this.convenio },
      external,
    ];
    const runs = await Promise.allSettled(sources.map((source) => source.strategy.searchHotels(dto)));

    const hotels: HotelSearchResult['hotels'][number][] = [];
    const status: SearchSourceStatus[] = [];
    let firstError: unknown;
    runs.forEach((run, index) => {
      const source = sources[index].type;
      if (run.status === 'fulfilled') {
        hotels.push(...run.value.hotels.map((hotel) => ({ ...hotel, source })));
        status.push({ source, status: 'OK', hotels: run.value.hotels.length });
      } else {
        firstError ??= run.reason;
        status.push({ source, status: 'ERROR', hotels: 0, message: this.describe(run.reason) });
      }
    });
    if (status.every((entry) => entry.status === 'ERROR')) {
      if (firstError instanceof HttpException) throw firstError;
      throw new ServiceUnavailableException('All hotel sources failed.');
    }
    return {
      transactionId: this.createId('ALL_SEARCH'),
      provider: ProviderType.ALL,
      totalItems: hotels.length,
      hotels,
      sources: status,
    };
  }

  public validateRate(dto: ValidateRateDto): Promise<RateValidationResult> {
    return this.route(dto.tripProductId).validateRate(dto);
  }

  public getCancellationFees(dto: CancellationFeesDto): Promise<CancellationFeesResult> {
    return this.route(dto.tripProductId).getCancellationFees(dto);
  }

  public getHotelDetails(hotelCode: string, dto: QueryHotelDetailsDto): Promise<HotelDetailsResult> {
    return this.route(hotelCode).getHotelDetails(hotelCode, dto);
  }

  public async getHotelCatalog(dto: QueryHotelCatalogDto): Promise<HotelCatalogResult> {
    const sources = [this.convenio, this.external().strategy];
    const runs = await Promise.allSettled(sources.map((strategy) => strategy.getHotelCatalog(dto)));
    const fulfilled = runs.flatMap((run) => (run.status === 'fulfilled' ? [run.value] : []));
    if (fulfilled.length === 0) throw new ServiceUnavailableException('All hotel sources failed.');
    const hotels = fulfilled.flatMap((catalog) => catalog.hotels);
    return {
      destinationCode: dto.destinationCode,
      destinationName: fulfilled.find((catalog) => catalog.destinationName)?.destinationName ?? dto.destinationCode,
      hotelCount: hotels.length,
      hotels,
    };
  }

  public bookHotel(_dto: BookHotelDto): Promise<BookingResult> {
    throw new BadRequestException(BOOKING_UNAVAILABLE);
  }

  public getBookingDetail(_locator: string): Promise<BookingDetailResult> {
    throw new BadRequestException(BOOKING_UNAVAILABLE);
  }

  public cancelBooking(_locator: string, _dto: CancelBookingDto): Promise<BookingCancellationResult> {
    throw new BadRequestException(BOOKING_UNAVAILABLE);
  }

  private external(): { type: ProviderType; strategy: HotelProviderStrategy } {
    return process.env.HOTEL_EXTERNAL_PROVIDER?.trim().toLowerCase() === 'nemo'
      ? { type: ProviderType.NEMO, strategy: this.nemo }
      : { type: ProviderType.MOCK, strategy: this.mock };
  }

  private route(id: string): HotelProviderStrategy {
    if (id.startsWith(CONVENIO_RATE_PREFIX) || id.startsWith(CONVENIO_HOTEL_CODE_PREFIX)) return this.convenio;
    if (id.startsWith('MOCK')) return this.mock;
    return this.external().strategy;
  }

  private describe(reason: unknown): string {
    return reason instanceof HttpException ? reason.message : 'Source failed.';
  }

  private createId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
  }
}
