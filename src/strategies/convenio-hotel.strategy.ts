import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { BoardType } from '../domain/enums/board-type.enum';
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
import { ConvenioHotel } from '../domain/models/convenio-hotel.model';
import { HotelCatalogResult } from '../domain/models/hotel-catalog.model';
import { HotelDetailsResult } from '../domain/models/hotel-details.model';
import { HotelItem, HotelRate, HotelSearchResult } from '../domain/models/hotel.model';
import { CancellationFeesResult, RateValidationResult } from '../domain/models/rate-lifecycle.model';
import {
  CONVENIO_HOTEL_REPOSITORY,
  IConvenioHotelRepository,
  normalizeCityKey,
} from '../repositories/convenio-hotel.repository.interface';
import { DESTINATION_REPOSITORY, IDestinationRepository } from '../repositories/destination.repository.interface';
import { HotelProviderStrategy } from './hotel-provider.strategy';

/** Los códigos y las tarifas de convenio empiezan así; el resto del back los usa para enrutar. */
export const CONVENIO_HOTEL_CODE_PREFIX = 'CNV-';
export const CONVENIO_RATE_PREFIX = 'CNV~';

const CANCELLATION_NOTE = 'Política de cancelación por confirmar con el hotel.';

interface ParsedRate {
  readonly supplierId: string;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly rooms: number;
  /** Precio cotizado al momento de la búsqueda (ver stayAmount), codificado en el tripProductId para
   *  poder detectar cambios de tarifa del catálogo antes de reservar (ver validateRate). */
  readonly quotedAmount: number;
}

/**
 * Hoteles con convenio (catálogo propio). Reglas acordadas:
 *  - Se busca por la CIUDAD del destino pedido; si el destino no se resuelve, no hay resultados.
 *  - Disponibilidad: siempre disponible mientras el convenio esté vigente a la llegada.
 *  - Precio: tarifa por noche y por cuarto × noches × cuartos. No se aplican persona extra
 *    ni desayuno aparte (por ahora).
 *  - La reserva todavía no está habilitada para esta fuente.
 */
@Injectable()
export class ConvenioHotelStrategy implements HotelProviderStrategy {
  private readonly bookings = new Map<string, BookingDetailResult>();
  private readonly cancellations = new Map<string, BookingCancellationResult>();

  public constructor(
    @Inject(CONVENIO_HOTEL_REPOSITORY) private readonly hotels: IConvenioHotelRepository,
    @Optional() @Inject(DESTINATION_REPOSITORY) private readonly destinations?: IDestinationRepository,
  ) {}

  public async searchHotels(dto: SearchHotelsDto): Promise<HotelSearchResult> {
    const tenantId = this.requireTenant(dto.tenantId);
    const cityKey = await this.resolveCityKey(dto.destinationId);
    const candidates = cityKey ? await this.hotels.findByCity(tenantId, cityKey) : [];
    const nights = this.calculateNights(dto.checkIn, dto.checkOut);
    const items = candidates
      .filter((hotel) => this.matches(hotel, dto))
      .map((hotel) => this.toItem(hotel, dto, nights));
    return {
      transactionId: this.createId('CNV_SEARCH'),
      provider: ProviderType.CONVENIO,
      totalItems: items.length,
      hotels: items,
    };
  }

  public async validateRate(dto: ValidateRateDto): Promise<RateValidationResult> {
    const tenantId = this.requireTenant(dto.tenantId);
    const { hotel, parsed } = await this.requireRate(tenantId, dto.tripProductId);
    const currentAmount = this.stayAmount(hotel, parsed.rooms, this.calculateNights(parsed.checkIn, parsed.checkOut));
    return {
      transactionId: this.createId('CNV_VALIDATE'),
      provider: ProviderType.CONVENIO,
      tripProductId: dto.tripProductId,
      validatedPrice: {
        amount: currentAmount,
        currency: hotel.currency,
        priceChanged: !this.sameAmount(currentAmount, parsed.quotedAmount),
      },
      availabilityStatus: 'Confirmed',
      rateStatus: 'Available',
    };
  }

  public async getCancellationFees(dto: CancellationFeesDto): Promise<CancellationFeesResult> {
    const tenantId = this.requireTenant(dto.tenantId);
    const { hotel } = await this.requireRate(tenantId, dto.tripProductId);
    // La política de cancelación de convenio no está modelada: sin tramos de penalización.
    return {
      transactionId: this.createId('CNV_FEES'),
      provider: ProviderType.CONVENIO,
      tripProductId: dto.tripProductId,
      currency: hotel.currency,
      feeSchedule: [],
    };
  }

  public async getHotelDetails(hotelCode: string, dto: QueryHotelDetailsDto): Promise<HotelDetailsResult> {
    const tenantId = this.requireTenant(dto.tenantId);
    const supplierId = this.supplierIdFromCode(hotelCode);
    const hotel = supplierId ? await this.hotels.findBySupplierId(tenantId, supplierId) : null;
    if (!hotel) throw new NotFoundException('Convenio hotel not found.');
    return {
      hotelCode,
      description: hotel.description ?? hotel.hotelName,
      checkInTime: '',
      checkOutTime: '',
      amenities: [],
      images: hotel.photoUrls.map((url) => ({ category: 'HOTEL', url })),
    };
  }

  public async getHotelCatalog(dto: QueryHotelCatalogDto): Promise<HotelCatalogResult> {
    const tenantId = this.requireTenant(dto.tenantId);
    const destination = await this.findDestination(dto.destinationCode);
    const cityKey = destination ? normalizeCityKey(destination.city ?? destination.label ?? '') : '';
    const hotels = cityKey ? await this.hotels.findByCity(tenantId, cityKey) : [];
    return {
      destinationCode: dto.destinationCode,
      destinationName: destination?.label ?? destination?.city ?? dto.destinationCode,
      hotelCount: hotels.length,
      hotels: hotels.map((hotel) => ({
        hotelCode: `${CONVENIO_HOTEL_CODE_PREFIX}${hotel.supplierId}`,
        hotelName: hotel.hotelName,
        rating: hotel.rating ?? 0,
        latitude: hotel.latitude ?? 0,
        longitude: hotel.longitude ?? 0,
        city: hotel.address.city,
        country: hotel.address.countryCode,
      })),
    };
  }

  /**
   * No hay proveedor externo que confirme: "reservar" es registrar la reserva localmente. La reserva
   * queda pendiente de que Operaciones la confirme (ver bookingStatus propagado a Care por el servicio).
   */
  public async bookHotel(dto: BookHotelDto): Promise<BookingResult> {
    const tenantId = this.requireTenant(dto.tenantId);
    const { hotel, parsed } = await this.requireRate(tenantId, dto.tripProductId);
    const nights = this.calculateNights(parsed.checkIn, parsed.checkOut);
    const booking: BookingResult = {
      bookingLocator: this.createId('CNV_BOOK'),
      supplierConfirmationCode: this.createId('CNV_CONF'),
      clientReference: dto.clientReference,
      creationDate: new Date().toISOString(),
      bookingStatus: 'PendingConfirmation',
      totalPrice: { amount: this.stayAmount(hotel, parsed.rooms, nights), currency: hotel.currency },
      hotelInformation: {
        hotelCode: `${CONVENIO_HOTEL_CODE_PREFIX}${hotel.supplierId}`,
        hotelName: hotel.hotelName,
        checkIn: parsed.checkIn,
        checkOut: parsed.checkOut,
      },
    };
    this.bookings.set(booking.bookingLocator, {
      bookingLocator: booking.bookingLocator,
      supplierConfirmationCode: booking.supplierConfirmationCode,
      clientReference: booking.clientReference,
      bookingStatus: booking.bookingStatus,
      totalPrice: { ...booking.totalPrice },
      hotelInformation: { ...booking.hotelInformation },
    });
    return booking;
  }

  public async getBookingDetail(locator: string): Promise<BookingDetailResult> {
    const booking = this.bookings.get(locator);
    if (!booking) throw new NotFoundException('Convenio booking not found.');
    return { ...booking, totalPrice: { ...booking.totalPrice }, hotelInformation: { ...booking.hotelInformation } };
  }

  // Sin política de cancelación modelada para convenio todavía (ver CANCELLATION_NOTE): se cancela sin penalización.
  public async cancelBooking(locator: string, _dto: CancelBookingDto): Promise<BookingCancellationResult> {
    const booking = this.bookings.get(locator);
    if (!booking) throw new NotFoundException('Convenio booking not found.');
    let cancellation = this.cancellations.get(locator);
    if (!cancellation) {
      cancellation = {
        bookingLocator: locator,
        cancellationStatus: 'Cancelled',
        cancellationReference: this.createId('CNV_CANCEL'),
        penaltyFee: { amount: 0, currency: booking.totalPrice.currency },
        refundAmount: { amount: booking.totalPrice.amount, currency: booking.totalPrice.currency },
      };
      booking.bookingStatus = cancellation.cancellationStatus;
      this.cancellations.set(locator, cancellation);
    }
    return { ...cancellation, penaltyFee: { ...cancellation.penaltyFee }, refundAmount: { ...cancellation.refundAmount } };
  }

  /** El convenio debe estar vigente al menos hasta la llegada. */
  private agreementIsValid(hotel: ConvenioHotel, checkIn: string): boolean {
    return hotel.agreementExpiresAt !== null && hotel.agreementExpiresAt >= checkIn;
  }

  private matches(hotel: ConvenioHotel, dto: SearchHotelsDto): boolean {
    if (hotel.ratePerNight === null || hotel.ratePerNight <= 0) return false;
    if (!this.agreementIsValid(hotel, dto.checkIn)) return false;
    if (dto.hotelName && !hotel.hotelName.toLowerCase().includes(dto.hotelName.toLowerCase())) return false;
    if (dto.hotelCodeList && !dto.hotelCodeList.includes(`${CONVENIO_HOTEL_CODE_PREFIX}${hotel.supplierId}`)) return false;
    const hasRatingFilter = dto.minRating !== undefined || dto.maxRating !== undefined || dto.ratings !== undefined;
    if (hotel.rating === null) {
      if (hasRatingFilter) return false;
    } else {
      if (hotel.rating < (dto.minRating ?? 1) || hotel.rating > (dto.maxRating ?? 5)) return false;
      if (dto.ratings !== undefined && !dto.ratings.includes(Math.round(hotel.rating))) return false;
    }
    if (dto.boardTypes !== undefined && !dto.boardTypes.includes(this.board(hotel).type)) return false;
    return true;
  }

  private board(hotel: ConvenioHotel): { type: BoardType; code: string; description: string } {
    return hotel.breakfastIncluded
      ? { type: BoardType.BED_AND_BREAKFAST, code: 'BB', description: 'Alojamiento y desayuno' }
      : { type: BoardType.ROOM_ONLY, code: 'RO', description: 'Solo alojamiento' };
  }

  private toItem(hotel: ConvenioHotel, dto: SearchHotelsDto, nights: number): HotelItem {
    const board = this.board(hotel);
    const amount = this.stayAmount(hotel, dto.rooms.length, nights);
    const rate: HotelRate = {
      tripProductId: this.rateId({
        supplierId: hotel.supplierId,
        checkIn: dto.checkIn,
        checkOut: dto.checkOut,
        rooms: dto.rooms.length,
        quotedAmount: amount,
      }),
      rateClass: 'Convenio',
      amount,
      currency: hotel.currency,
      roomRates: dto.rooms.map((room) => ({
        roomSequence: room.roomSequence,
        roomType: 'Habitación estándar (tarifa de convenio)',
        boardCode: board.code,
        boardDescription: board.description,
      })),
      cancellationPolicy: { refundable: false, note: CANCELLATION_NOTE },
      bookable: true,
      ...(hotel.rateIncludesTax !== null ? { taxesIncluded: hotel.rateIncludesTax } : {}),
    };
    return {
      hotelCode: `${CONVENIO_HOTEL_CODE_PREFIX}${hotel.supplierId}`,
      hotelName: hotel.hotelName,
      rating: hotel.rating ?? 0,
      address: hotel.address,
      ...(hotel.latitude !== null ? { latitude: hotel.latitude } : {}),
      ...(hotel.longitude !== null ? { longitude: hotel.longitude } : {}),
      ...(hotel.photoUrls.length > 0 ? { thumbnailUrl: hotel.photoUrls[0] } : {}),
      rates: [rate],
      source: ProviderType.CONVENIO,
    };
  }

  private stayAmount(hotel: ConvenioHotel, rooms: number, nights: number): number {
    return Number(((hotel.ratePerNight ?? 0) * rooms * nights).toFixed(2));
  }

  /**
   * El precio cotizado se codifica igual que lo redondea stayAmount (2 decimales, vía toFixed) para
   * que el id sea estable y la comparación en validateRate no sufra imprecisión de punto flotante.
   */
  private rateId(parsed: ParsedRate): string {
    return `${CONVENIO_RATE_PREFIX}${parsed.supplierId}~${parsed.checkIn}~${parsed.checkOut}~${parsed.rooms}~${parsed.quotedAmount.toFixed(2)}`;
  }

  private parseRateId(id: string): ParsedRate | null {
    if (!id.startsWith(CONVENIO_RATE_PREFIX)) return null;
    const parts = id.slice(CONVENIO_RATE_PREFIX.length).split('~');
    if (parts.length !== 5) return null;
    const [supplierId, checkIn, checkOut, rooms, quotedAmount] = parts;
    const roomCount = Number(rooms);
    const amount = Number(quotedAmount);
    if (!supplierId || !/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)
      || !Number.isInteger(roomCount) || roomCount < 1
      || !/^\d+\.\d{2}$/.test(quotedAmount) || !Number.isFinite(amount) || amount < 0) {
      return null;
    }
    return { supplierId, checkIn, checkOut, rooms: roomCount, quotedAmount: amount };
  }

  /** Compara en centavos (enteros) para evitar falsos "cambió el precio" por imprecisión de punto flotante. */
  private sameAmount(a: number, b: number): boolean {
    return Math.round(a * 100) === Math.round(b * 100);
  }

  private async requireRate(tenantId: string, tripProductId: string): Promise<{ hotel: ConvenioHotel; parsed: ParsedRate }> {
    const parsed = this.parseRateId(tripProductId);
    const hotel = parsed ? await this.hotels.findBySupplierId(tenantId, parsed.supplierId) : null;
    if (!parsed || !hotel || hotel.ratePerNight === null || !this.agreementIsValid(hotel, parsed.checkIn)) {
      throw new NotFoundException('Requested convenio rate was not found or the agreement is no longer valid.');
    }
    return { hotel, parsed };
  }

  private requireTenant(tenantId: string | undefined): string {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    return tenantId;
  }

  private supplierIdFromCode(hotelCode: string): string | null {
    return hotelCode.startsWith(CONVENIO_HOTEL_CODE_PREFIX) ? hotelCode.slice(CONVENIO_HOTEL_CODE_PREFIX.length) : null;
  }

  private async findDestination(destinationId: string) {
    try {
      return (await this.destinations?.findById(destinationId, 'es')) ?? null;
    } catch {
      // Catálogo de destinos no disponible: sin ciudad no hay búsqueda de convenio.
      return null;
    }
  }

  private async resolveCityKey(destinationId: string): Promise<string> {
    const destination = await this.findDestination(destinationId);
    return destination ? normalizeCityKey(destination.city ?? destination.label ?? '') : '';
  }

  private calculateNights(checkIn: string, checkOut: string): number {
    const millisecondsPerDay = 86_400_000;
    return Math.max(1, Math.round(
      (new Date(`${checkOut}T00:00:00.000Z`).getTime() - new Date(`${checkIn}T00:00:00.000Z`).getTime()) / millisecondsPerDay,
    ));
  }

  private createId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
  }
}
