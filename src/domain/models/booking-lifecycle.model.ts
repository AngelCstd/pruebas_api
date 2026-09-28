import { BookingResult } from './booking.model';

export interface BookingDetailResult extends Omit<BookingResult, 'creationDate'> {
  cancellationDeadline?: string;
  voucherUrl?: string;
}

export interface BookingCancellationResult {
  bookingLocator: string;
  cancellationStatus: string;
  cancellationReference: string;
  penaltyFee: { amount: number; currency: string };
  refundAmount: { amount: number; currency: string };
}
