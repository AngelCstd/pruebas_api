import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { BookingGuestDto, BookingPassengerDto, BookHotelDto, LeadPassengerDto } from '../domain/dtos/book-hotel.dto';
import { CancelBookingDto } from '../domain/dtos/cancel-booking.dto';
import { ProviderType } from '../domain/enums/provider.enum';
import { BookingListResult, BookingOperation, IdempotentBookingResult, ListedBookingStatus } from '../domain/models/booking-operation.model';
import { BookingCancellationResult, BookingDetailResult } from '../domain/models/booking-lifecycle.model';
import { BookingResult } from '../domain/models/booking.model';
import {
  CareFailureResult,
  CreateReservationPayload,
  CreateReservationSuccess,
  ReservationPersonPayload,
  StoredBookingResult,
} from '../domain/models/care-reservation.model';
import {
  BOOKING_OPERATION_REPOSITORY,
  IBookingOperationRepository,
} from '../repositories/booking-operation.repository.interface';
import {
  CARE_RESERVATION_REPOSITORY,
  ICareReservationRepository,
} from '../repositories/care-reservation.repository.interface';
import { HotelStrategyFactory } from '../strategies/hotel-strategy.factory';

const IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

@Injectable()
export class BookingApplicationService {
  public constructor(
    private readonly strategyFactory: HotelStrategyFactory,
    @Inject(BOOKING_OPERATION_REPOSITORY) private readonly operations: IBookingOperationRepository,
    @Inject(CARE_RESERVATION_REPOSITORY) private readonly care: ICareReservationRepository,
  ) {}

  public async bookHotel(
    dto: BookHotelDto,
    provider: ProviderType,
    idempotencyKey: string | undefined,
  ): Promise<IdempotentBookingResult> {
    this.requireMock(provider);
    const tenantId = this.requireTenant(dto.tenantId);
    if (!idempotencyKey || !IDEMPOTENCY_KEY.test(idempotencyKey)) {
      throw new BadRequestException('Idempotency-Key header is required and must have a valid format.');
    }

    const fingerprint = this.bookingFingerprint(dto);
    const claim = await this.operations.claim(tenantId, {
      provider: ProviderType.MOCK,
      idempotencyKey,
      requestFingerprint: fingerprint,
      clientReference: dto.clientReference,
      leadPassengerName: this.localLeadName(dto.leadPassenger),
      requestPayload: dto,
    });
    let operation = claim.operation;
    if (!claim.created) {
      if (operation.requestFingerprint !== fingerprint) {
        throw this.conflict('IDEMPOTENCY_KEY_REUSED', 'Idempotency-Key was already used with different content.');
      }
      if (operation.status === 'BOOKED' || operation.status === 'CANCELLED') {
        if (!operation.responsePayload) {
          throw new ServiceUnavailableException('Stored booking operation has no response payload.');
        }
        return { ...operation.responsePayload, operationId: operation.id, idempotentReplay: true };
      }
      if (operation.status === 'PENDING') {
        throw this.conflict('IDEMPOTENCY_IN_PROGRESS', 'A booking with this Idempotency-Key is still in progress.');
      }
      const retried = await this.operations.retryFailed(tenantId, operation.id);
      if (!retried) {
        throw this.conflict('IDEMPOTENCY_IN_PROGRESS', 'A booking with this Idempotency-Key is still in progress.');
      }
      operation = retried;
    }

    const serviceId = this.serviceId(operation.id);
    let creditHeld = false;
    let reservationCreated = false;
    try {
      const strategy = this.strategyFactory.resolve(ProviderType.MOCK);
      const validation = await strategy.validateRate({ tenantId, tripProductId: dto.tripProductId });
      if (validation.validatedPrice.priceChanged) {
        throw this.conflict('PRICE_CHANGED', 'The hotel rate price changed. Please repeat the search.');
      }

      const leadPassengerName = await this.resolveLeadName(tenantId, dto);
      operation = await this.operations.updateLeadPassengerName(tenantId, operation.id, leadPassengerName);

      const hold = await this.care.holdCredit({
        tenantId,
        clientOrganizationId: dto.clientOrganizationId,
        tripServiceId: serviceId,
        amount: validation.validatedPrice.amount,
        currency: validation.validatedPrice.currency,
      });
      if (!hold.ok) throw this.careException(hold, 409);
      creditHeld = true;

      const providerResult = await strategy.bookHotel(dto);
      const careResult = await this.care.createReservation(this.reservationPayload(dto, operation.id, providerResult));
      if (!careResult.ok) throw this.createReservationException(careResult);
      reservationCreated = true;

      const result = this.withReservation(providerResult, careResult);
      const booked = await this.operations.markBooked(tenantId, operation.id, result);
      return { ...result, operationId: booked.id, idempotentReplay: false };
    } catch (error: unknown) {
      if (reservationCreated) {
        // La reserva y su cargo YA existen en Care (el fallo fue al cerrar la operación). Liberar el crédito
        // dejaría un cargo sin crédito retenido y permitiría gastar de más, y marcarla FAILED permitiría
        // reintentar y duplicar. Se deja la operación pendiente de conciliar y se conserva la retención.
        throw error;
      }
      if (creditHeld) {
        try {
          await this.care.releaseCredit(tenantId, serviceId);
        } catch {
          // El error original conserva prioridad; la liberación ya fue intentada.
        }
      }
      try {
        await this.operations.markFailed(tenantId, operation.id, this.failureCode(error));
      } catch {
        // El error original es parte del contrato de la llamada.
      }
      throw error;
    }
  }

  public async getBookingDetail(locator: string, provider: ProviderType, tenantIdValue?: string): Promise<BookingDetailResult> {
    this.requireMock(provider);
    const tenantId = this.requireTenant(tenantIdValue);
    const operation = await this.operations.findByLocator(tenantId, locator);
    if (operation?.responsePayload) return this.toDetail(operation);
    return this.strategyFactory.resolve(ProviderType.MOCK).getBookingDetail(locator);
  }

  public async cancelBooking(
    locator: string,
    dto: CancelBookingDto,
    provider: ProviderType,
  ): Promise<BookingCancellationResult> {
    this.requireMock(provider);
    const tenantId = this.requireTenant(dto.tenantId);
    const operation = await this.operations.findByLocator(tenantId, locator);
    if (operation?.status === 'CANCELLED' && operation.cancellationPayload) return operation.cancellationPayload;
    const result = await this.strategyFactory.resolve(ProviderType.MOCK).cancelBooking(locator, dto);
    if (operation) await this.operations.markCancelled(tenantId, operation.id, result);
    return result;
  }

  public async listBookings(
    provider: ProviderType,
    limit = 50,
    status?: ListedBookingStatus,
    tenantIdValue?: string,
  ): Promise<BookingListResult> {
    this.requireMock(provider);
    const tenantId = this.requireTenant(tenantIdValue);
    return { items: await this.care.listReservations(tenantId, limit, status) };
  }

  private async resolveLeadName(tenantId: string, dto: BookHotelDto): Promise<string> {
    const personId = dto.leadPassenger.personId;
    if (personId) {
      const name = await this.care.findPersonName(tenantId, dto.clientOrganizationId, personId);
      if (name) return name;
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        message: `Person ${personId} was not found for the selected client.`,
        code: 'PERSON_NOT_FOUND',
      });
    }
    return this.localLeadName(dto.leadPassenger);
  }

  private localLeadName(lead: LeadPassengerDto): string {
    return `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim() || lead.personId || '';
  }

  private reservationPayload(dto: BookHotelDto, operationId: string, result: BookingResult): CreateReservationPayload {
    return {
      tenantId: this.requireTenant(dto.tenantId),
      operationId,
      clientOrganizationId: dto.clientOrganizationId,
      source: 'MOCK',
      providerLabel: 'Mock provider',
      hotel: {
        code: result.hotelInformation.hotelCode,
        name: result.hotelInformation.hotelName,
        checkIn: result.hotelInformation.checkIn,
        checkOut: result.hotelInformation.checkOut,
      },
      providerBookingRef: result.bookingLocator,
      supplierConfirmationCode: result.supplierConfirmationCode,
      providerStatus: result.bookingStatus,
      clientReference: dto.clientReference,
      amount: result.totalPrice.amount,
      currency: result.totalPrice.currency,
      lead: this.personPayload(dto.leadPassenger),
      rooms: dto.rooms.map((room) => ({
        roomSequence: room.roomSequence,
        guests: room.guests.map((guest) => this.personPayload(guest)),
      })),
      offerSnapshot: { tripProductId: dto.tripProductId },
    };
  }

  private personPayload(person: BookingPassengerDto | BookingGuestDto | LeadPassengerDto): ReservationPersonPayload {
    if (person.personId) return { personId: person.personId };
    if (!person.firstName || !person.lastName) throw new BadRequestException('Passenger name is incomplete.');
    const contact = person as LeadPassengerDto;
    return {
      firstName: person.firstName,
      lastName: person.lastName,
      ...(contact.email ? { email: contact.email } : {}),
      ...(contact.phone ? { phone: contact.phone } : {}),
    };
  }

  private withReservation(result: BookingResult, care: CreateReservationSuccess): StoredBookingResult {
    return {
      ...result,
      reservation: {
        tripId: care.tripId,
        serviceId: care.serviceId,
        bookingId: care.bookingId,
        hotelDetailId: care.hotelDetailId,
        chargeIds: care.chargeIds,
        itemIds: care.itemIds,
        dueAt: care.dueAt,
      },
    };
  }

  private serviceId(operationId: string): string {
    const separator = operationId.indexOf('_');
    return `svc_${separator >= 0 ? operationId.slice(separator + 1) : operationId}`;
  }

  private requireMock(provider: ProviderType): void {
    if (provider === ProviderType.MOCK) return;
    if (provider === ProviderType.ALL) {
      throw new BadRequestException('Booking is not available with provider=all; use the provider of the selected rate.');
    }
    throw new HttpException({
      statusCode: 501,
      message: `Booking is not enabled for provider=${provider}.`,
      error: 'Not Implemented',
      code: 'BOOKING_NOT_ENABLED',
    }, 501);
  }

  private conflict(code: string, message: string): ConflictException {
    return new ConflictException({ statusCode: 409, message, error: 'Conflict', code });
  }

  private careException(failure: CareFailureResult, status: 400 | 404 | 409): HttpException {
    const error = status === 400 ? 'Bad Request' : status === 404 ? 'Not Found' : 'Conflict';
    return new HttpException({
      statusCode: status,
      error,
      message: failure.message,
      code: failure.errorCode,
      ...(failure.available !== undefined ? { available: failure.available } : {}),
      ...(failure.requested !== undefined ? { requested: failure.requested } : {}),
      ...(failure.currency !== undefined ? { currency: failure.currency } : {}),
    }, status);
  }

  private createReservationException(failure: CareFailureResult): HttpException {
    if (failure.errorCode === 'PERSON_NOT_FOUND') return this.careException(failure, 404);
    if (failure.errorCode === 'INVALID_PAYLOAD' || failure.errorCode === 'PERSON_INCOMPLETE') {
      return this.careException(failure, 400);
    }
    return this.careException(failure, 409);
  }

  private bookingFingerprint(dto: BookHotelDto): string {
    const { tenantId: _tenantId, ...value } = dto;
    return createHash('sha256').update(this.canonicalJson(value)).digest('hex');
  }

  private requireTenant(tenantId: string | undefined): string {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    return tenantId;
  }

  private canonicalJson(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map((item) => this.canonicalJson(item)).join(',')}]`;
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record).filter((key) => record[key] !== undefined).sort()
      .map((key) => `${JSON.stringify(key)}:${this.canonicalJson(record[key])}`);
    return `{${entries.join(',')}}`;
  }

  private failureCode(error: unknown): string {
    if (error instanceof HttpException) {
      const response: unknown = error.getResponse();
      if (typeof response === 'object' && response !== null) {
        const code = (response as Record<string, unknown>).code;
        if (typeof code === 'string') return code;
      }
      return String(error.getStatus());
    }
    return error instanceof Error ? error.name : 'UNKNOWN_ERROR';
  }

  private toDetail(operation: BookingOperation): BookingDetailResult {
    const response = operation.responsePayload;
    if (!response) throw new ServiceUnavailableException('Stored booking operation has no response payload.');
    return {
      bookingLocator: response.bookingLocator,
      supplierConfirmationCode: response.supplierConfirmationCode,
      clientReference: response.clientReference,
      bookingStatus: operation.status === 'CANCELLED' ? 'Cancelled' : response.bookingStatus,
      totalPrice: response.totalPrice,
      hotelInformation: response.hotelInformation,
    };
  }
}
