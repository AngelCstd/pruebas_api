import { ListedBookingStatus, BookingSummary } from '../domain/models/booking-operation.model';
import {
  ClientCredit,
  CreateReservationPayload,
  CreateReservationResult,
  HoldCreditInput,
  HoldCreditResult,
  PersonSummary,
  ReleaseCreditResult,
} from '../domain/models/care-reservation.model';

export const CARE_RESERVATION_REPOSITORY = Symbol('CARE_RESERVATION_REPOSITORY');

export interface ICareReservationRepository {
  listClients(tenantId: string): Promise<readonly ClientCredit[]>;
  listPersons(tenantId: string, organizationId: string, q: string | undefined, limit: number): Promise<readonly PersonSummary[]>;
  findPersonName(tenantId: string, organizationId: string, personId: string): Promise<string | null>;
  holdCredit(input: HoldCreditInput): Promise<HoldCreditResult>;
  releaseCredit(tenantId: string, tripServiceId: string): Promise<ReleaseCreditResult>;
  createReservation(payload: CreateReservationPayload): Promise<CreateReservationResult>;
  listReservations(tenantId: string, limit: number, status?: ListedBookingStatus): Promise<readonly BookingSummary[]>;
}
