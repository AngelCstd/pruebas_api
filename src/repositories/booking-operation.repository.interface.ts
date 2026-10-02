import {
  BookingOperation,
  BookingOperationClaim,
  CreateBookingOperation,
} from '../domain/models/booking-operation.model';
import { BookingCancellationResult } from '../domain/models/booking-lifecycle.model';
import { StoredBookingResult } from '../domain/models/care-reservation.model';

export const BOOKING_OPERATION_REPOSITORY = Symbol('BOOKING_OPERATION_REPOSITORY');

export interface IBookingOperationRepository {
  claim(tenantId: string, input: CreateBookingOperation): Promise<BookingOperationClaim>;
  retryFailed(tenantId: string, id: string): Promise<BookingOperation | null>;
  updateLeadPassengerName(tenantId: string, id: string, leadPassengerName: string): Promise<BookingOperation>;
  markBooked(tenantId: string, id: string, result: StoredBookingResult): Promise<BookingOperation>;
  markFailed(tenantId: string, id: string, failureCode: string): Promise<void>;
  findByLocator(tenantId: string, locator: string): Promise<BookingOperation | null>;
  markCancelled(tenantId: string, id: string, result: BookingCancellationResult): Promise<BookingOperation>;
}
