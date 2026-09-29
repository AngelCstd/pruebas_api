import { BoardType } from '../domain/enums/board-type.enum';
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
import { GoneException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { SearchHotelsDto } from '../domain/dtos/search-hotels.dto';
import { ProviderType } from '../domain/enums/provider.enum';
import { HotelItem, HotelRate, HotelSearchResult } from '../domain/models/hotel.model';
import { DESTINATION_REPOSITORY, IDestinationRepository } from '../repositories/destination.repository.interface';
import { HotelProviderStrategy } from './hotel-provider.strategy';
import {
  FALLBACK_PLACE,
  MOCK_HOTEL_CODE_PATTERN,
  MockPlace,
  MockRateTemplate,
  amenityName,
  buildDescription,
  buildHotelProfiles,
  buildPlace,
  buildPolicies,
  checkTimes,
  roomFactor,
  thumbnailUrl,
} from './mock-hotel-fixtures';

@Injectable()
export class MockHotelStrategy implements HotelProviderStrategy {
  private readonly bookings = new Map<string, BookingDetailResult>();
  private readonly cancellations = new Map<string, BookingCancellationResult>();
  private readonly products = new Map<string, { rate: HotelRate; checkIn: string; createdAt: number; hotelInformation?: BookingResult['hotelInformation'] }>();
  private readonly places = new Map<string, MockPlace>();

  public constructor(
    @Optional() @Inject(DESTINATION_REPOSITORY) private readonly destinations?: IDestinationRepository,
  ) {}

  /**
   * Resuelve ciudad y país del destino desde el catálogo `hotel_destinations`.
   * Si el catálogo no está disponible o el destino no existe, usa el fixture de Madrid.
   */
  private async resolvePlace(destinationId: string): Promise<MockPlace> {
    const cached = this.places.get(destinationId);
    if (cached) return cached;
    try {
      const item = await this.destinations?.findById(destinationId, 'es');
      if (item) {
        const city = item.city ?? item.label ?? 'Destino';
        const place = buildPlace(destinationId, city, item.country ?? '', item.countryId ?? 'ES', item.label ?? city);
        this.places.set(destinationId, place);
        return place;
      }
    } catch {
      // Catálogo no configurado o no disponible: el mock sigue funcionando offline.
    }
    return FALLBACK_PLACE;
  }

  public async validateRate(dto: ValidateRateDto): Promise<RateValidationResult> {
    const { rate } = this.getProduct(dto.tripProductId);
    return {
      transactionId: this.createId('MOCK_VALIDATE'), provider: ProviderType.MOCK,
      tripProductId: dto.tripProductId,
      validatedPrice: { amount: rate.amount, currency: rate.currency, priceChanged: dto.tripProductId === 'MOCK-PRICE-002' },
      availabilityStatus: 'Confirmed', rateStatus: 'Available',
    };
  }

  public async getCancellationFees(dto: CancellationFeesDto): Promise<CancellationFeesResult> {
    const { rate, checkIn, createdAt } = this.getProduct(dto.tripProductId);
    const deadline = rate.cancellationPolicy.deadline;
    const arrival = Date.parse(`${checkIn}T00:00:00.000Z`);
    const start = deadline ? Date.parse(deadline) : createdAt;
    return {
      transactionId: this.createId('MOCK_FEES'), provider: ProviderType.MOCK,
      tripProductId: dto.tripProductId, currency: rate.currency,
      ...(deadline ? { freeCancellationDeadline: deadline } : {}),
      feeSchedule: deadline ? [
        { startDate: new Date(start).toISOString(), endDate: new Date(arrival - 1).toISOString(),
          feeAmount: Number((rate.amount * 0.5).toFixed(2)), penaltyPercentage: 50 },
        { startDate: new Date(arrival).toISOString(), feeAmount: rate.amount, penaltyPercentage: 100 },
      ] : [{ startDate: new Date(start).toISOString(), feeAmount: rate.amount, penaltyPercentage: 100 }],
    };
  }

  private getProduct(id: string): { rate: HotelRate; checkIn: string; createdAt: number; hotelInformation?: BookingResult['hotelInformation'] } {
    if (id === 'MOCK-EXP-001') throw new GoneException('The hotel rate session has expired. Please refresh search.');
    if (id === 'MOCK-PRICE-002') {
      return { rate: { tripProductId: id, rateClass: 'Standard', amount: 935, currency: 'EUR',
        roomRates: [], cancellationPolicy: { refundable: true, deadline: '2026-11-12T00:00:00.000Z' } },
        checkIn: '2026-11-15', createdAt: Date.now() };
    }
    const product = this.products.get(id);
    if (!product) throw new NotFoundException('Requested hotel rate was not found.');
    if (Date.now() - product.createdAt >= 30 * 60_000) {
      throw new GoneException('The hotel rate session has expired. Please refresh search.');
    }
    return product;
  }

  public async searchHotels(dto: SearchHotelsDto): Promise<HotelSearchResult> {
    for (const [id, product] of this.products) {
      if (Date.now() - product.createdAt >= 30 * 60_000) this.products.delete(id);
    }
    const nights = this.calculateNights(dto.checkIn, dto.checkOut);
    const place = await this.resolvePlace(dto.destinationId);
    const hotels = this.createHotels(dto, nights, place).filter((hotel) => {
      const nameMatches = dto.hotelName
        ? hotel.hotelName.toLowerCase().includes(dto.hotelName.toLowerCase())
        : true;
      const ratingMatches = hotel.rating >= (dto.minRating ?? 1)
        && hotel.rating <= (dto.maxRating ?? 5)
        && (dto.ratings === undefined || dto.ratings.includes(hotel.rating));
      return nameMatches && ratingMatches
        && (dto.hotelCodeList === undefined || dto.hotelCodeList.includes(hotel.hotelCode));
    }).map((hotel) => ({ ...hotel, rates: hotel.rates.filter((rate) => {
      const boardCodes: Readonly<Record<string, BoardType>> = {
        RO: BoardType.ROOM_ONLY, BB: BoardType.BED_AND_BREAKFAST, HB: BoardType.HALF_BOARD,
      };
      return dto.boardTypes === undefined || rate.roomRates.every(
        (room) => dto.boardTypes?.includes(boardCodes[room.boardCode]),
      );
    }) })).filter((hotel) => hotel.rates.length > 0);

    for (const hotel of hotels) {
      for (const rate of hotel.rates) {
        const product = this.products.get(rate.tripProductId);
        if (product) product.hotelInformation = { hotelCode: hotel.hotelCode, hotelName: hotel.hotelName, checkIn: dto.checkIn, checkOut: dto.checkOut };
      }
    }

    return Promise.resolve({
      transactionId: this.createId('MOCK_SEARCH'),
      provider: ProviderType.MOCK,
      totalItems: hotels.length,
      hotels,
    });
  }

  private createHotels(dto: SearchHotelsDto, nights: number, place: MockPlace): HotelItem[] {
    return buildHotelProfiles(dto.destinationId, place).map((profile) => ({
      hotelCode: profile.hotelCode,
      hotelName: profile.hotelName,
      rating: profile.rating,
      address: profile.address,
      latitude: profile.latitude,
      longitude: profile.longitude,
      rates: profile.rateTemplates.map((template) => this.createRate(dto, template, nights, place.currency)),
      propertyType: profile.propertyType,
      thumbnailUrl: thumbnailUrl(profile),
      reviewScore: profile.reviewScore,
      reviewCount: profile.reviewCount,
      distanceToCenterKm: profile.distanceToCenterKm,
      amenities: profile.amenityCodes.slice(0, 5).map((code) => amenityName(code, 'es')),
    }));
  }

  private createRate(dto: SearchHotelsDto, template: MockRateTemplate, nights: number, currency: string): HotelRate {
    const deadline = new Date(`${dto.checkIn}T00:00:00.000Z`);
    deadline.setUTCDate(deadline.getUTCDate() - 3);
    const roomsFactor = dto.rooms.reduce((sum, room) => sum + roomFactor(room.roomType), 0);
    const pricePerNight = Number((template.pricePerNight * roomsFactor).toFixed(2));
    const rate: HotelRate = {
      tripProductId: this.createId('MOCK_TRIP'),
      rateClass: template.rateClass,
      amount: Number((template.pricePerNight * roomsFactor * nights).toFixed(2)),
      currency,
      roomRates: dto.rooms.map((room) => ({
        roomSequence: room.roomSequence,
        roomType: this.roomLabel(room.roomType),
        boardCode: template.boardCode,
        boardDescription: template.boardDescription,
      })),
      cancellationPolicy: {
        refundable: template.refundable,
        ...(template.refundable ? { deadline: deadline.toISOString() } : {}),
      },
      nights,
      pricePerNight,
    };
    this.products.set(rate.tripProductId, { rate, checkIn: dto.checkIn, createdAt: Date.now() });
    return rate;
  }

  private roomLabel(roomType: string): string {
    const labels: Readonly<Record<string, string>> = {
      'NMO.HTL.RMT.SGL': 'Classic Single Room',
      'NMO.HTL.RMT.DBL': 'Deluxe Double Room',
      'NMO.HTL.RMT.TPL': 'Superior Triple Room',
      'NMO.HTL.RMT.QUA': 'Family Quadruple Room',
      'NMO.HTL.RMT.QUD': 'Family Quadruple Room',
    };
    return labels[roomType] ?? 'Standard Room';
  }

  private calculateNights(checkIn: string, checkOut: string): number {
    const millisecondsPerDay = 86_400_000;
    return Math.max(1, Math.round(
      (new Date(`${checkOut}T00:00:00.000Z`).getTime()
        - new Date(`${checkIn}T00:00:00.000Z`).getTime()) / millisecondsPerDay,
    ));
  }

  private createId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
  }
  public async getHotelDetails(hotelCode: string, dto: QueryHotelDetailsDto): Promise<HotelDetailsResult> {
    const match = MOCK_HOTEL_CODE_PATTERN.exec(hotelCode);
    if (!match) throw new NotFoundException('Mock hotel not found.');
    const [, destinationId, sequence] = match;
    const language = (dto.language ?? 'es').toLowerCase().startsWith('es') ? 'es' : 'en';
    const place = await this.resolvePlace(destinationId);
    const profile = buildHotelProfiles(destinationId, place)[Number(sequence) - 1];
    if (!profile) throw new NotFoundException('Mock hotel not found.');
    return {
      hotelCode,
      hotelName: profile.hotelName,
      rating: profile.rating,
      propertyType: profile.propertyType,
      address: profile.address,
      latitude: profile.latitude,
      longitude: profile.longitude,
      reviewScore: profile.reviewScore,
      reviewCount: profile.reviewCount,
      policies: buildPolicies(profile, language),
      description: buildDescription(profile, place, language),
      ...checkTimes(profile),
      amenities: profile.amenityCodes.map((code) => ({ code, name: amenityName(code, language) })),
      images: profile.images.map((image) => ({ ...image })),
    };
  }

  public async getHotelCatalog(dto: QueryHotelCatalogDto): Promise<HotelCatalogResult> {
    const place = await this.resolvePlace(dto.destinationCode);
    const hotels = buildHotelProfiles(dto.destinationCode, place).slice(0, 3).map((profile) => ({
      hotelCode: profile.hotelCode, hotelName: profile.hotelName, rating: profile.rating,
      latitude: profile.latitude, longitude: profile.longitude, city: place.city, country: place.countryCode,
    })).filter((_, index) => !(dto.activeOnly ?? true) || index < 2);
    return { destinationCode: dto.destinationCode, destinationName: place.label, hotelCount: hotels.length, hotels };
  }

  public async bookHotel(dto: BookHotelDto): Promise<BookingResult> {
    const product = this.getProduct(dto.tripProductId);
    if (!product.hotelInformation) throw new NotFoundException('Search for a mock hotel before booking.');
    const booking: BookingResult = { bookingLocator: this.createId('MOCK_BOOK'), supplierConfirmationCode: this.createId('MOCK_CONF'),
      clientReference: dto.clientReference, creationDate: new Date().toISOString(), bookingStatus: 'Confirmed',
      totalPrice: { amount: product.rate.amount, currency: product.rate.currency }, hotelInformation: { ...product.hotelInformation } };
    this.bookings.set(booking.bookingLocator, {
      bookingLocator: booking.bookingLocator, supplierConfirmationCode: booking.supplierConfirmationCode,
      clientReference: booking.clientReference, bookingStatus: booking.bookingStatus,
      totalPrice: { ...booking.totalPrice }, hotelInformation: { ...booking.hotelInformation },
      ...(product.rate.cancellationPolicy.deadline ? { cancellationDeadline: product.rate.cancellationPolicy.deadline } : {}),
      voucherUrl: `https://mock.example.com/vouchers/${booking.bookingLocator}.pdf`,
    });
    return booking;
  }

  public async getBookingDetail(locator: string): Promise<BookingDetailResult> {
    const booking = this.bookings.get(locator);
    if (!booking) throw new NotFoundException('Mock booking not found.');
    return { ...booking, totalPrice: { ...booking.totalPrice }, hotelInformation: { ...booking.hotelInformation } };
  }

  public async cancelBooking(locator: string, _dto: CancelBookingDto): Promise<BookingCancellationResult> {
    const booking = this.bookings.get(locator);
    if (!booking) throw new NotFoundException('Mock booking not found.');
    let cancellation = this.cancellations.get(locator);
    if (!cancellation) {
      const now = Date.now();
      const arrival = Date.parse(`${booking.hotelInformation.checkIn}T00:00:00.000Z`);
      const fraction = !booking.cancellationDeadline || now >= arrival ? 1
        : now >= Date.parse(booking.cancellationDeadline) ? 0.5 : 0;
      const penalty = Number((booking.totalPrice.amount * fraction).toFixed(2));
      cancellation = {
        bookingLocator: locator, cancellationStatus: penalty > 0 ? 'CancelledWithCharges' : 'Cancelled',
        cancellationReference: this.createId('MOCK_CANCEL'),
        penaltyFee: { amount: penalty, currency: booking.totalPrice.currency },
        refundAmount: { amount: Number((booking.totalPrice.amount - penalty).toFixed(2)), currency: booking.totalPrice.currency },
      };
      booking.bookingStatus = cancellation.cancellationStatus;
      this.cancellations.set(locator, cancellation);
    }
    return { ...cancellation, penaltyFee: { ...cancellation.penaltyFee }, refundAmount: { ...cancellation.refundAmount } };
  }

}
