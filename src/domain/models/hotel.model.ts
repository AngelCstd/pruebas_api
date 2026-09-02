import { ProviderType } from '../enums/provider.enum';

export interface HotelAddress {
  readonly street: string;
  readonly city: string;
  readonly postalCode: string;
  readonly countryCode: string;
}

export interface HotelRoomRate {
  readonly roomSequence: number;
  readonly roomType: string;
  readonly boardCode: string;
  readonly boardDescription: string;
}

export interface HotelCancellationPolicy {
  readonly refundable: boolean;
  readonly deadline?: string;
}

export interface HotelRate {
  readonly tripProductId: string;
  readonly rateClass: string;
  readonly amount: number;
  readonly currency: string;
  readonly roomRates: readonly HotelRoomRate[];
  readonly cancellationPolicy: HotelCancellationPolicy;
}

export interface HotelItem {
  readonly hotelCode: string;
  readonly hotelName: string;
  readonly rating: number;
  readonly address: HotelAddress;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly rates: readonly HotelRate[];
}

export interface HotelSearchResult {
  readonly transactionId: string;
  readonly provider: ProviderType;
  readonly totalItems: number;
  readonly hotels: readonly HotelItem[];
}
