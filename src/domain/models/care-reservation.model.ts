import { BookingResult } from './booking.model';

export type CreditCurrency = 'MXN' | 'USD' | 'EUR';
export type CreditStatus = 'ACTIVE' | 'HOLD' | 'SUSPENDED';

export interface ClientCredit {
  readonly organizationId: string;
  readonly name: string;
  readonly creditAccountId: string;
  readonly currency: CreditCurrency;
  readonly creditStatus: CreditStatus;
  readonly creditLimit: number;
  readonly used: number;
  readonly available: number;
}

export interface PersonSummary {
  readonly personId: string;
  readonly fullName: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly organizationId: string;
}

export interface HoldCreditInput {
  readonly tenantId: string;
  readonly clientOrganizationId: string;
  readonly tripServiceId: string;
  readonly amount: number;
  readonly currency: string;
}

export interface CareFailureResult {
  readonly ok: false;
  readonly errorCode: string;
  readonly message: string;
  readonly available?: number;
  readonly requested?: number;
  readonly currency?: string;
}

export interface HoldCreditSuccess {
  readonly ok: true;
  readonly utilizationId?: string;
  readonly replay?: boolean;
  readonly available?: number;
  readonly currency?: string;
}

export type HoldCreditResult = HoldCreditSuccess | CareFailureResult;

export interface ReleaseCreditResult {
  readonly ok: boolean;
  readonly released: number;
}

export type ReservationPersonPayload =
  | { readonly personId: string }
  | { readonly firstName: string; readonly lastName: string; readonly email?: string; readonly phone?: string };

export interface CreateReservationPayload {
  readonly tenantId: string;
  readonly operationId: string;
  readonly clientOrganizationId: string;
  readonly source: 'MOCK';
  readonly providerLabel: 'Mock provider';
  readonly hotel: {
    readonly code: string;
    readonly name: string;
    readonly checkIn: string;
    readonly checkOut: string;
    readonly address?: string;
    readonly city?: string;
  };
  readonly providerBookingRef: string;
  readonly supplierConfirmationCode: string;
  readonly providerStatus: string;
  readonly clientReference: string;
  readonly amount: number;
  readonly currency: string;
  readonly lead: ReservationPersonPayload;
  readonly rooms: readonly {
    readonly roomSequence: number;
    readonly guests: readonly ReservationPersonPayload[];
  }[];
  readonly offerSnapshot: { readonly tripProductId: string };
}

export interface CreateReservationSuccess {
  readonly ok: true;
  readonly tripId: string;
  readonly serviceId: string;
  readonly bookingId: string;
  readonly hotelDetailId: string;
  readonly chargeIds: readonly string[];
  readonly itemIds: readonly string[];
  readonly personIds: readonly string[];
  readonly dueAt: string;
  readonly currency: string;
  readonly amount: number;
  readonly replay: boolean;
}

export type CreateReservationResult = CreateReservationSuccess | CareFailureResult;

export interface ReservationIdentifiers {
  readonly tripId: string;
  readonly serviceId: string;
  readonly bookingId: string;
  readonly hotelDetailId: string;
  readonly chargeIds: readonly string[];
  readonly itemIds: readonly string[];
  readonly dueAt: string;
}

export interface StoredBookingResult extends BookingResult {
  readonly reservation: ReservationIdentifiers;
}
