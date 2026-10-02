import { Injectable } from '@nestjs/common';
import { BookingSummary, ListedBookingStatus } from '../domain/models/booking-operation.model';
import { ProviderType } from '../domain/enums/provider.enum';
import {
  ClientCredit,
  CreateReservationPayload,
  CreateReservationResult,
  HoldCreditInput,
  HoldCreditResult,
  PersonSummary,
  ReleaseCreditResult,
} from '../domain/models/care-reservation.model';
import { ICareReservationRepository } from './care-reservation.repository.interface';

export interface InMemoryCareReservationOptions {
  readonly tenantId?: string;
  readonly clients?: readonly ClientCredit[];
  readonly persons?: readonly PersonSummary[];
  readonly reservations?: readonly BookingSummary[];
  readonly holdResult?: HoldCreditResult;
  readonly createResult?: CreateReservationResult;
}

/** Repositorio observable y determinista para pruebas; la aplicación usa Supabase. */
@Injectable()
export class InMemoryCareReservationRepository implements ICareReservationRepository {
  public readonly holds: HoldCreditInput[] = [];
  public readonly releases: { readonly tenantId: string; readonly tripServiceId: string }[] = [];
  public readonly createdReservations: CreateReservationPayload[] = [];
  public holdResult: HoldCreditResult;
  public createResult?: CreateReservationResult;

  private readonly clients: { readonly tenantId: string; readonly value: ClientCredit }[];
  private readonly persons: { readonly tenantId: string; readonly value: PersonSummary }[];
  private readonly reservations: { readonly tenantId: string; readonly value: BookingSummary }[];

  public constructor(options: InMemoryCareReservationOptions = {}) {
    const tenantId = options.tenantId ?? 'tenant-a';
    this.clients = structuredClone(options.clients ?? []).map((value) => ({ tenantId, value }));
    this.persons = structuredClone(options.persons ?? []).map((value) => ({ tenantId, value }));
    this.reservations = structuredClone(options.reservations ?? []).map((value) => ({ tenantId, value }));
    this.holdResult = structuredClone(options.holdResult ?? {
      ok: true, utilizationId: 'cutl_test', replay: false, available: 100_000, currency: 'MXN',
    });
    this.createResult = options.createResult === undefined ? undefined : structuredClone(options.createResult);
  }

  public async listClients(tenantId: string): Promise<readonly ClientCredit[]> {
    return this.clients.filter((item) => item.tenantId === tenantId).map((item) => structuredClone(item.value))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  public async listPersons(
    tenantId: string,
    organizationId: string,
    q: string | undefined,
    limit: number,
  ): Promise<readonly PersonSummary[]> {
    const search = q?.trim().toLocaleLowerCase();
    return this.persons.filter((item) => item.tenantId === tenantId).map((item) => structuredClone(item.value))
      .filter((person) => person.organizationId === organizationId)
      .filter((person) => !search
        || person.fullName.toLocaleLowerCase().includes(search)
        || person.email?.toLocaleLowerCase().includes(search) === true)
      .sort((left, right) => left.fullName.localeCompare(right.fullName))
      .slice(0, limit);
  }

  public async findPersonName(tenantId: string, organizationId: string, personId: string): Promise<string | null> {
    return this.persons.find((item) => item.tenantId === tenantId
      && item.value.organizationId === organizationId && item.value.personId === personId)?.value.fullName ?? null;
  }

  public async holdCredit(input: HoldCreditInput): Promise<HoldCreditResult> {
    this.holds.push(structuredClone(input));
    return structuredClone(this.holdResult);
  }

  public async releaseCredit(tenantId: string, tripServiceId: string): Promise<ReleaseCreditResult> {
    this.releases.push({ tenantId, tripServiceId });
    return { ok: true, released: 1 };
  }

  public async createReservation(payload: CreateReservationPayload): Promise<CreateReservationResult> {
    this.createdReservations.push(structuredClone(payload));
    const suffix = payload.operationId.slice(payload.operationId.indexOf('_') + 1);
    const result = this.createResult ?? {
      ok: true,
      tripId: `trp_${suffix}`,
      serviceId: `svc_${suffix}`,
      bookingId: `bkg_${suffix}`,
      hotelDetailId: `hot_${suffix}`,
      chargeIds: [`chg_${suffix}_1`],
      itemIds: [`tsi_${suffix}_1`],
      personIds: [],
      dueAt: '2027-12-01',
      currency: payload.currency,
      amount: payload.amount,
      replay: false,
    } satisfies CreateReservationResult;
    if (result.ok) {
      this.reservations.push({ tenantId: payload.tenantId, value: {
        operationId: payload.operationId,
        provider: ProviderType.MOCK,
        status: payload.providerStatus === 'CANCELLED' ? 'CANCELLED' : 'BOOKED',
        bookingLocator: payload.providerBookingRef,
        supplierConfirmationCode: payload.supplierConfirmationCode,
        clientReference: payload.clientReference,
        hotelCode: payload.hotel.code,
        hotelName: payload.hotel.name,
        checkIn: payload.hotel.checkIn,
        checkOut: payload.hotel.checkOut,
        totalPrice: { amount: payload.amount, currency: payload.currency },
        leadPassengerName: this.leadName(payload),
        createdAt: new Date().toISOString(),
        cancelledAt: null,
        clientName: this.clients.find((client) => client.tenantId === payload.tenantId
          && client.value.organizationId === payload.clientOrganizationId)?.value.name ?? null,
        tripId: result.tripId,
        outstanding: payload.amount,
        dueAt: result.dueAt,
      } });
    }
    return structuredClone(result);
  }

  public async listReservations(
    tenantId: string,
    limit: number,
    status?: ListedBookingStatus,
  ): Promise<readonly BookingSummary[]> {
    if (status === 'FAILED') return [];
    return this.reservations.filter((item) => item.tenantId === tenantId).map((item) => structuredClone(item.value))
      .filter((reservation) => status === undefined || reservation.status === status)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);
  }

  private leadName(payload: CreateReservationPayload): string {
    const lead = payload.lead;
    return 'personId' in lead
      ? this.persons.find((person) => person.tenantId === payload.tenantId
        && person.value.personId === lead.personId)?.value.fullName ?? ''
      : `${lead.firstName} ${lead.lastName}`.trim();
  }
}
