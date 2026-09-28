import { ProviderType } from '../enums/provider.enum';

export interface RateValidationResult {
  readonly transactionId: string;
  readonly provider: ProviderType;
  readonly tripProductId: string;
  readonly validatedPrice: {
    readonly amount: number;
    readonly currency: string;
    readonly priceChanged: boolean;
  };
  readonly availabilityStatus: string;
  readonly rateStatus: string;
}

export interface CancellationFeeTier {
  readonly startDate: string;
  readonly endDate?: string;
  readonly feeAmount: number;
  readonly penaltyPercentage: number;
}

export interface CancellationFeesResult {
  readonly transactionId: string;
  readonly provider: ProviderType;
  readonly tripProductId: string;
  readonly currency: string;
  readonly freeCancellationDeadline?: string;
  readonly feeSchedule: readonly CancellationFeeTier[];
}
