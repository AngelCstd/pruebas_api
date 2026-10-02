import { Injectable } from '@nestjs/common';
import {
  BookingOperation,
  BookingOperationClaim,
  CreateBookingOperation,
  ListedBookingStatus,
} from '../domain/models/booking-operation.model';
import { BookingCancellationResult } from '../domain/models/booking-lifecycle.model';
import { StoredBookingResult } from '../domain/models/care-reservation.model';
import { IBookingOperationRepository } from './booking-operation.repository.interface';

/** Repositorio determinista para pruebas; la aplicación usa Supabase. */
@Injectable()
export class InMemoryBookingOperationRepository implements IBookingOperationRepository {
  private readonly operations = new Map<string, Map<string, BookingOperation>>();
  private sequence = 0;

  public async claim(tenantId: string, input: CreateBookingOperation): Promise<BookingOperationClaim> {
    const existing = [...this.tenantOperations(tenantId).values()].find((operation) => (
      operation.provider === input.provider && operation.idempotencyKey === input.idempotencyKey
    ));
    if (existing) return { created: false, operation: this.clone(existing) };
    const now = new Date().toISOString();
    const operation: BookingOperation = {
      id: `hbo_test_${++this.sequence}`,
      ...input,
      status: 'PENDING',
      bookingLocator: null,
      supplierConfirmationCode: null,
      hotelCode: null,
      hotelName: null,
      checkIn: null,
      checkOut: null,
      totalAmount: null,
      currency: null,
      responsePayload: null,
      cancellationPayload: null,
      failureCode: null,
      createdAt: now,
      updatedAt: now,
      cancelledAt: null,
    };
    this.tenantOperations(tenantId).set(operation.id, operation);
    return { created: true, operation: this.clone(operation) };
  }

  public async retryFailed(tenantId: string, id: string): Promise<BookingOperation | null> {
    const operation = this.tenantOperations(tenantId).get(id);
    if (!operation || operation.status !== 'FAILED') return null;
    return this.replace(tenantId, operation, { status: 'PENDING', failureCode: null });
  }

  public async updateLeadPassengerName(tenantId: string, id: string, leadPassengerName: string): Promise<BookingOperation> {
    return this.replace(tenantId, this.require(tenantId, id), { leadPassengerName });
  }

  public async markBooked(tenantId: string, id: string, result: StoredBookingResult): Promise<BookingOperation> {
    const operation = this.require(tenantId, id);
    return this.replace(tenantId, operation, {
      status: 'BOOKED',
      bookingLocator: result.bookingLocator,
      supplierConfirmationCode: result.supplierConfirmationCode,
      hotelCode: result.hotelInformation.hotelCode,
      hotelName: result.hotelInformation.hotelName,
      checkIn: result.hotelInformation.checkIn,
      checkOut: result.hotelInformation.checkOut,
      totalAmount: result.totalPrice.amount,
      currency: result.totalPrice.currency,
      responsePayload: result,
      failureCode: null,
    });
  }

  public async markFailed(tenantId: string, id: string, failureCode: string): Promise<void> {
    const operation = this.require(tenantId, id);
    this.replace(tenantId, operation, { status: 'FAILED', failureCode });
  }

  public async findByLocator(tenantId: string, locator: string): Promise<BookingOperation | null> {
    const operation = [...this.tenantOperations(tenantId).values()].find((item) => item.bookingLocator === locator);
    return operation ? this.clone(operation) : null;
  }

  public async markCancelled(tenantId: string, id: string, result: BookingCancellationResult): Promise<BookingOperation> {
    const operation = this.require(tenantId, id);
    return this.replace(tenantId, operation, {
      status: 'CANCELLED',
      cancellationPayload: result,
      cancelledAt: new Date().toISOString(),
    });
  }

  public async list(tenantId: string, limit: number, status?: ListedBookingStatus): Promise<readonly BookingOperation[]> {
    return [...this.tenantOperations(tenantId).values()]
      .filter((operation) => operation.status !== 'PENDING' && (status === undefined || operation.status === status))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id))
      .slice(0, limit)
      .map((operation) => this.clone(operation));
  }

  private require(tenantId: string, id: string): BookingOperation {
    const operation = this.tenantOperations(tenantId).get(id);
    if (!operation) throw new Error(`Booking operation ${id} was not found.`);
    return operation;
  }

  private replace(tenantId: string, operation: BookingOperation, patch: Partial<BookingOperation>): BookingOperation {
    const updated = { ...operation, ...patch, updatedAt: new Date().toISOString() };
    this.tenantOperations(tenantId).set(updated.id, updated);
    return this.clone(updated);
  }

  private clone(operation: BookingOperation): BookingOperation {
    return structuredClone(operation);
  }

  private tenantOperations(tenantId: string): Map<string, BookingOperation> {
    let operations = this.operations.get(tenantId);
    if (!operations) {
      operations = new Map<string, BookingOperation>();
      this.operations.set(tenantId, operations);
    }
    return operations;
  }
}
