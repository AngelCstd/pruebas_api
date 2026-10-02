import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ProviderType } from '../domain/enums/provider.enum';
import { BookingSummary, ListedBookingStatus } from '../domain/models/booking-operation.model';
import {
  CareFailureResult,
  ClientCredit,
  CreateReservationPayload,
  CreateReservationResult,
  CreditCurrency,
  CreditStatus,
  HoldCreditInput,
  HoldCreditResult,
  PersonSummary,
  ReleaseCreditResult,
} from '../domain/models/care-reservation.model';
import { ICareReservationRepository } from './care-reservation.repository.interface';

interface ClientCreditRow {
  readonly organization_id: string;
  readonly name: string;
  readonly credit_account_id: string;
  readonly currency: string;
  readonly credit_status: string;
  readonly credit_limit: number | string;
  readonly used: number | string;
  readonly available: number | string;
}

interface PersonRow {
  readonly person_id: string;
  readonly full_name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly organization_id: string;
}

interface ReservationRow {
  readonly trip_service_id: string;
  readonly trip_id: string;
  readonly booking_locator: string | null;
  readonly booking_status: string | null;
  readonly operation_id: string | null;
  readonly client_reference: string | null;
  readonly hotel_code: string | null;
  readonly client_name: string | null;
  readonly traveler_name: string | null;
  readonly hotel_name: string | null;
  readonly check_in_at: string | null;
  readonly check_out_at: string | null;
  readonly confirmation_number: string | null;
  readonly source: string | null;
  readonly currency: string | null;
  readonly charged: number | string | null;
  readonly outstanding: number | string | null;
  readonly next_due_at: string | null;
  readonly created_at: string;
}

const CLIENT_COLUMNS = 'organization_id, name, credit_account_id, currency, credit_status, credit_limit, used, available';
const PERSON_COLUMNS = 'person_id, full_name, email, phone, organization_id';
const RESERVATION_COLUMNS = [
  'trip_service_id', 'trip_id', 'booking_locator', 'booking_status', 'operation_id', 'client_reference',
  'hotel_code', 'client_name', 'traveler_name', 'hotel_name', 'check_in_at', 'check_out_at',
  'confirmation_number', 'source', 'currency', 'charged', 'outstanding', 'next_due_at', 'created_at',
].join(', ');

@Injectable()
export class SupabaseCareReservationRepository implements ICareReservationRepository {
  private readonly logger = new Logger(SupabaseCareReservationRepository.name);
  private client?: SupabaseClient;

  public async listClients(tenantId: string): Promise<readonly ClientCredit[]> {
    const { data, error } = await this.getClient().from('client_credit_v').select(CLIENT_COLUMNS)
      .eq('tenant_id', tenantId).order('name', { ascending: true }).returns<ClientCreditRow[]>();
    if (error) this.unavailable('list clients', error.message);
    return (data ?? []).map((row) => ({
      organizationId: row.organization_id,
      name: row.name,
      creditAccountId: row.credit_account_id,
      currency: row.currency as CreditCurrency,
      creditStatus: row.credit_status as CreditStatus,
      creditLimit: Number(row.credit_limit),
      used: Number(row.used),
      available: Number(row.available),
    }));
  }

  public async listPersons(
    tenantId: string,
    organizationId: string,
    q: string | undefined,
    limit: number,
  ): Promise<readonly PersonSummary[]> {
    let query = this.getClient().from('client_persons_v').select(PERSON_COLUMNS)
      .eq('tenant_id', tenantId).eq('organization_id', organizationId)
      .order('full_name', { ascending: true }).limit(limit);
    const search = q?.trim();
    if (search) {
      const pattern = `"%${this.escapeOrValue(search)}%"`;
      query = query.or(`full_name.ilike.${pattern},email.ilike.${pattern}`);
    }
    const { data, error } = await query.returns<PersonRow[]>();
    if (error) this.unavailable('list persons', error.message);
    return (data ?? []).map((row) => this.toPerson(row));
  }

  public async findPersonName(tenantId: string, organizationId: string, personId: string): Promise<string | null> {
    const { data, error } = await this.getClient().from('client_persons_v').select('full_name')
      .eq('tenant_id', tenantId).eq('organization_id', organizationId).eq('person_id', personId)
      .maybeSingle<{ readonly full_name: string }>();
    if (error) this.unavailable('find person', error.message);
    return data?.full_name ?? null;
  }

  public async holdCredit(input: HoldCreditInput): Promise<HoldCreditResult> {
    const { data, error } = await this.getClient().rpc('hold_hotel_credit_v1', {
      p_tenant_id: input.tenantId,
      p_client_organization_id: input.clientOrganizationId,
      p_trip_service_id: input.tripServiceId,
      p_amount: input.amount,
      p_currency: input.currency,
    });
    if (error) this.unavailable('hold hotel credit', error.message);
    return this.toHoldResult(data);
  }

  public async releaseCredit(tenantId: string, tripServiceId: string): Promise<ReleaseCreditResult> {
    const { data, error } = await this.getClient().rpc('release_hotel_credit_v1', {
      p_tenant_id: tenantId,
      p_trip_service_id: tripServiceId,
    });
    if (error) this.unavailable('release hotel credit', error.message);
    const value = this.record(data, 'release hotel credit');
    return { ok: value.ok === true, released: this.number(value.released, 0) };
  }

  public async createReservation(payload: CreateReservationPayload): Promise<CreateReservationResult> {
    const { data, error } = await this.getClient().rpc('create_hotel_reservation_v1', { p_payload: payload });
    if (error) this.unavailable('create hotel reservation', error.message);
    const value = this.record(data, 'create hotel reservation');
    if (value.ok !== true) return this.toFailure(value);
    return {
      ok: true,
      tripId: this.string(value.tripId, 'tripId'),
      serviceId: this.string(value.serviceId, 'serviceId'),
      bookingId: this.string(value.bookingId, 'bookingId'),
      hotelDetailId: this.string(value.hotelDetailId, 'hotelDetailId'),
      chargeIds: this.stringArray(value.chargeIds),
      itemIds: this.stringArray(value.itemIds),
      personIds: this.stringArray(value.personIds),
      dueAt: this.string(value.dueAt, 'dueAt'),
      currency: this.string(value.currency, 'currency'),
      amount: this.number(value.amount),
      replay: value.replay === true,
    };
  }

  public async listReservations(
    tenantId: string,
    limit: number,
    status?: ListedBookingStatus,
  ): Promise<readonly BookingSummary[]> {
    const client = this.getClient();
    if (status === 'FAILED') return [];
    let query = client.from('hotel_reservations_v').select(RESERVATION_COLUMNS)
      .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(limit);
    if (status === 'CANCELLED') query = query.eq('booking_status', 'CANCELLED');
    if (status === 'BOOKED') query = query.neq('booking_status', 'CANCELLED');
    const { data, error } = await query.returns<ReservationRow[]>();
    if (error) this.unavailable('list hotel reservations', error.message);
    return (data ?? []).map((row) => this.toSummary(row));
  }

  private getClient(): SupabaseClient {
    if (this.client) return this.client;
    const url = process.env.SUPABASE_URL?.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!url || !key) throw new ServiceUnavailableException('Care reservation store is not configured.');
    this.client = createClient(url, key, { auth: { persistSession: false } });
    return this.client;
  }

  private toPerson(row: PersonRow): PersonSummary {
    return {
      personId: row.person_id,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      organizationId: row.organization_id,
    };
  }

  private toSummary(row: ReservationRow): BookingSummary {
    return {
      operationId: row.operation_id ?? row.trip_service_id,
      provider: (row.source ?? 'MOCK').toLowerCase() as Exclude<ProviderType, ProviderType.ALL>,
      status: row.booking_status === 'CANCELLED' ? 'CANCELLED' : 'BOOKED',
      bookingLocator: row.booking_locator,
      supplierConfirmationCode: row.confirmation_number,
      clientReference: row.client_reference ?? '',
      hotelCode: row.hotel_code,
      hotelName: row.hotel_name,
      checkIn: this.dateOnly(row.check_in_at),
      checkOut: this.dateOnly(row.check_out_at),
      totalPrice: row.charged === null || row.currency === null
        ? null : { amount: Number(row.charged), currency: row.currency },
      leadPassengerName: row.traveler_name ?? '',
      createdAt: new Date(row.created_at).toISOString(),
      cancelledAt: null,
      clientName: row.client_name,
      tripId: row.trip_id,
      outstanding: row.outstanding === null ? null : Number(row.outstanding),
      dueAt: this.dateOnly(row.next_due_at),
    };
  }

  private toHoldResult(data: unknown): HoldCreditResult {
    const value = this.record(data, 'hold hotel credit');
    if (value.ok !== true) return this.toFailure(value);
    return {
      ok: true,
      ...(typeof value.utilizationId === 'string' ? { utilizationId: value.utilizationId } : {}),
      ...(typeof value.available === 'number' || typeof value.available === 'string'
        ? { available: Number(value.available) } : {}),
      ...(typeof value.currency === 'string' ? { currency: value.currency } : {}),
      replay: value.replay === true,
    };
  }

  private toFailure(value: Record<string, unknown>): CareFailureResult {
    return {
      ok: false,
      errorCode: typeof value.errorCode === 'string' ? value.errorCode : 'UNKNOWN_CARE_ERROR',
      message: typeof value.message === 'string' ? value.message : 'Care rejected the operation.',
      ...(typeof value.available === 'number' || typeof value.available === 'string'
        ? { available: Number(value.available) } : {}),
      ...(typeof value.requested === 'number' || typeof value.requested === 'string'
        ? { requested: Number(value.requested) } : {}),
      ...(typeof value.currency === 'string' ? { currency: value.currency } : {}),
    };
  }

  private record(value: unknown, action: string): Record<string, unknown> {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    this.unavailable(action, 'invalid response');
  }

  private string(value: unknown, field: string): string {
    if (typeof value === 'string' && value.length > 0) return value;
    this.unavailable('read Care response', `${field} is missing`);
  }

  private number(value: unknown, fallback?: number): number {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
    if (fallback !== undefined) return fallback;
    this.unavailable('read Care response', 'invalid numeric value');
  }

  private stringArray(value: unknown): readonly string[] {
    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value;
    this.unavailable('read Care response', 'invalid identifier list');
  }

  private dateOnly(value: string | null): string | null {
    return value === null ? null : value.slice(0, 10);
  }

  private escapeOrValue(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[%_]/g, (character) => `\\${character}`);
  }

  private unavailable(action: string, message?: string): never {
    this.logger.error(`Could not ${action}: ${message ?? 'unknown Supabase error'}`);
    throw new ServiceUnavailableException('Care reservation store is temporarily unavailable.');
  }
}
