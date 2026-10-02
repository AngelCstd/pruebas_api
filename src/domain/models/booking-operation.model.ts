import { BookHotelDto } from '../dtos/book-hotel.dto';
import { ProviderType } from '../enums/provider.enum';
import { BookingCancellationResult } from './booking-lifecycle.model';
import { StoredBookingResult } from './care-reservation.model';

export type BookingOperationStatus = 'PENDING' | 'BOOKED' | 'CANCELLED' | 'FAILED';
export type ListedBookingStatus = Exclude<BookingOperationStatus, 'PENDING'>;

export interface BookingOperation {
  readonly id: string;
  readonly provider: Exclude<ProviderType, ProviderType.ALL>;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
  readonly status: BookingOperationStatus;
  readonly bookingLocator: string | null;
  readonly supplierConfirmationCode: string | null;
  readonly clientReference: string;
  readonly hotelCode: string | null;
  readonly hotelName: string | null;
  readonly checkIn: string | null;
  readonly checkOut: string | null;
  readonly totalAmount: number | null;
  readonly currency: string | null;
  readonly leadPassengerName: string;
  readonly requestPayload: BookHotelDto;
  readonly responsePayload: StoredBookingResult | null;
  readonly cancellationPayload: BookingCancellationResult | null;
  readonly failureCode: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly cancelledAt: string | null;
}

export interface CreateBookingOperation {
  readonly provider: Exclude<ProviderType, ProviderType.ALL>;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
  readonly clientReference: string;
  readonly leadPassengerName: string;
  readonly requestPayload: BookHotelDto;
}

export interface BookingOperationClaim {
  readonly created: boolean;
  readonly operation: BookingOperation;
}

export interface BookingSummary {
  readonly operationId: string;
  readonly provider: Exclude<ProviderType, ProviderType.ALL>;
  readonly status: ListedBookingStatus;
  readonly bookingLocator: string | null;
  readonly supplierConfirmationCode: string | null;
  readonly clientReference: string;
  readonly hotelCode: string | null;
  readonly hotelName: string | null;
  readonly checkIn: string | null;
  readonly checkOut: string | null;
  readonly totalPrice: { readonly amount: number; readonly currency: string } | null;
  readonly leadPassengerName: string;
  readonly createdAt: string;
  readonly cancelledAt: string | null;
  readonly clientName: string | null;
  readonly tripId: string;
  readonly outstanding: number | null;
  readonly dueAt: string | null;
}

export interface BookingListResult {
  readonly items: readonly BookingSummary[];
}

export interface IdempotentBookingResult extends StoredBookingResult {
  readonly operationId: string;
  readonly idempotentReplay: boolean;
}
