import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  BookingOperation,
  BookingOperationClaim,
  CreateBookingOperation,
} from '../domain/models/booking-operation.model';
import { BookingCancellationResult } from '../domain/models/booking-lifecycle.model';
import { StoredBookingResult } from '../domain/models/care-reservation.model';
import { ProviderType } from '../domain/enums/provider.enum';
import { BookHotelDto } from '../domain/dtos/book-hotel.dto';
import { IBookingOperationRepository } from './booking-operation.repository.interface';

interface BookingOperationRow {
  readonly id: string;
  readonly provider: string;
  readonly idempotency_key: string;
  readonly request_fingerprint: string;
  readonly status: string;
  readonly booking_locator: string | null;
  readonly supplier_confirmation_code: string | null;
  readonly client_reference: string;
  readonly hotel_code: string | null;
  readonly hotel_name: string | null;
  readonly check_in: string | null;
  readonly check_out: string | null;
  readonly total_amount: number | string | null;
  readonly currency: string | null;
  readonly lead_passenger_name: string;
  readonly request_payload: unknown;
  readonly response_payload: unknown;
  readonly cancellation_payload: unknown;
  readonly failure_code: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly cancelled_at: string | null;
}

const TABLE = 'hotel_booking_operations';
const COLUMNS = [
  'id', 'provider', 'idempotency_key', 'request_fingerprint', 'status', 'booking_locator',
  'supplier_confirmation_code', 'client_reference', 'hotel_code', 'hotel_name', 'check_in',
  'check_out', 'total_amount', 'currency', 'lead_passenger_name', 'request_payload',
  'response_payload', 'cancellation_payload', 'failure_code', 'created_at', 'updated_at',
  'cancelled_at',
].join(', ');

/** Persistencia de idempotencia con llave de servicio; toda consulta se acota al tenant. */
@Injectable()
export class SupabaseBookingOperationRepository implements IBookingOperationRepository {
  private readonly logger = new Logger(SupabaseBookingOperationRepository.name);
  private client?: SupabaseClient;

  public async claim(tenantId: string, input: CreateBookingOperation): Promise<BookingOperationClaim> {
    const { data, error } = await this.getClient().from(TABLE).insert({
      tenant_id: tenantId,
      provider: input.provider,
      idempotency_key: input.idempotencyKey,
      request_fingerprint: input.requestFingerprint,
      status: 'PENDING',
      client_reference: input.clientReference,
      lead_passenger_name: input.leadPassengerName,
      request_payload: input.requestPayload,
    }).select(COLUMNS).single<BookingOperationRow>();
    if (!error && data) return { created: true, operation: this.toOperation(data) };
    if (error?.code === '23505') {
      const existing = await this.findByKey(tenantId, input.provider, input.idempotencyKey);
      if (existing) return { created: false, operation: existing };
    }
    this.unavailable('claim', error?.message);
  }

  public async retryFailed(tenantId: string, id: string): Promise<BookingOperation | null> {
    const { data, error } = await this.getClient().from(TABLE)
      .update({ status: 'PENDING', failure_code: null, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId).eq('id', id).eq('status', 'FAILED')
      .select(COLUMNS).maybeSingle<BookingOperationRow>();
    if (error) this.unavailable('retry failed operation', error.message);
    return data ? this.toOperation(data) : null;
  }

  public async updateLeadPassengerName(tenantId: string, id: string, leadPassengerName: string): Promise<BookingOperation> {
    return this.updateOne(tenantId, id, {
      lead_passenger_name: leadPassengerName,
      updated_at: new Date().toISOString(),
    }, 'update lead passenger name');
  }

  public async markBooked(tenantId: string, id: string, result: StoredBookingResult): Promise<BookingOperation> {
    return this.updateOne(tenantId, id, {
      status: 'BOOKED',
      booking_locator: result.bookingLocator,
      supplier_confirmation_code: result.supplierConfirmationCode,
      hotel_code: result.hotelInformation.hotelCode,
      hotel_name: result.hotelInformation.hotelName,
      check_in: result.hotelInformation.checkIn,
      check_out: result.hotelInformation.checkOut,
      total_amount: result.totalPrice.amount,
      currency: result.totalPrice.currency,
      response_payload: result,
      failure_code: null,
      updated_at: new Date().toISOString(),
    }, 'close booked operation');
  }

  public async markFailed(tenantId: string, id: string, failureCode: string): Promise<void> {
    await this.updateOne(tenantId, id, {
      status: 'FAILED', failure_code: failureCode, updated_at: new Date().toISOString(),
    }, 'close failed operation');
  }

  public async findByLocator(tenantId: string, locator: string): Promise<BookingOperation | null> {
    const { data, error } = await this.getClient().from(TABLE).select(COLUMNS)
      .eq('tenant_id', tenantId).eq('booking_locator', locator)
      .maybeSingle<BookingOperationRow>();
    if (error) this.unavailable('find booking operation', error.message);
    return data ? this.toOperation(data) : null;
  }

  public async markCancelled(tenantId: string, id: string, result: BookingCancellationResult): Promise<BookingOperation> {
    const now = new Date().toISOString();
    return this.updateOne(tenantId, id, {
      status: 'CANCELLED', cancellation_payload: result, cancelled_at: now, updated_at: now,
    }, 'cancel booking operation');
  }

  private async findByKey(tenantId: string, provider: string, key: string): Promise<BookingOperation | null> {
    const { data, error } = await this.getClient().from(TABLE).select(COLUMNS)
      .eq('tenant_id', tenantId).eq('provider', provider).eq('idempotency_key', key)
      .maybeSingle<BookingOperationRow>();
    if (error) this.unavailable('read claimed operation', error.message);
    return data ? this.toOperation(data) : null;
  }

  private async updateOne(tenantId: string, id: string, values: Record<string, unknown>, action: string): Promise<BookingOperation> {
    const { data, error } = await this.getClient().from(TABLE).update(values)
      .eq('tenant_id', tenantId).eq('id', id)
      .select(COLUMNS).single<BookingOperationRow>();
    if (error || !data) this.unavailable(action, error?.message);
    return this.toOperation(data);
  }

  private getClient(): SupabaseClient {
    if (this.client) return this.client;
    const url = process.env.SUPABASE_URL?.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!url || !key) throw new ServiceUnavailableException('Booking operation store is not configured.');
    this.client = createClient(url, key, { auth: { persistSession: false } });
    return this.client;
  }

  private unavailable(action: string, message?: string): never {
    this.logger.error(`Could not ${action}: ${message ?? 'unknown Supabase error'}`);
    throw new ServiceUnavailableException('Booking operation store is temporarily unavailable.');
  }

  private toOperation(row: BookingOperationRow): BookingOperation {
    return {
      id: row.id,
      provider: row.provider as Exclude<ProviderType, ProviderType.ALL>,
      idempotencyKey: row.idempotency_key,
      requestFingerprint: row.request_fingerprint,
      status: row.status as BookingOperation['status'],
      bookingLocator: row.booking_locator,
      supplierConfirmationCode: row.supplier_confirmation_code,
      clientReference: row.client_reference,
      hotelCode: row.hotel_code,
      hotelName: row.hotel_name,
      checkIn: row.check_in,
      checkOut: row.check_out,
      totalAmount: row.total_amount === null ? null : Number(row.total_amount),
      currency: row.currency,
      leadPassengerName: row.lead_passenger_name,
      requestPayload: row.request_payload as BookHotelDto,
      responsePayload: row.response_payload as StoredBookingResult | null,
      cancellationPayload: row.cancellation_payload as BookingCancellationResult | null,
      failureCode: row.failure_code,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      cancelledAt: row.cancelled_at,
    };
  }
}
