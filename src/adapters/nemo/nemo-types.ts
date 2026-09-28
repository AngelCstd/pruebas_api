export interface NemoXmlAttributes {
  readonly '@_TransactionId': string;
  readonly '@_TransactionMode': 'Synchronous';
}

export interface NemoRoomRequest {
  readonly '@_RoomType': string;
  readonly '@_RoomSequence': string;
}

export interface NemoPassengerRequest {
  readonly '@_AgeType': string;
  readonly '@_RoomSequence': string;
  readonly '@_Age'?: string;
}

export interface AvailabilityQueryRQ extends NemoXmlAttributes {
  readonly GeneralParameters: {
    readonly PreferedLanguage: string;
    readonly PreferedCurrency: string;
  };
  readonly Trips: { readonly Trip: { readonly Destination: string } };
  readonly HotelsParameters: {
    readonly Criterion: {
      readonly Rooms: { readonly Room: readonly NemoRoomRequest[] };
      readonly CheckIn: string;
      readonly CheckOut: string;
      readonly Availability: 'CNF';
      readonly HotelName?: string;
      readonly Ratings?: string;
      readonly HotelCodeList?: string;
      readonly BoardTypes?: string;
    };
  };
  readonly Passengers: { readonly Passenger: readonly NemoPassengerRequest[] };
  readonly RequestSet: {
    readonly FirstItem: string;
    readonly ItemsPerPage: string;
  };
}

export interface AvailabilityQueryRQDocument {
  readonly '?xml': {
    readonly '@_version': '1.0';
    readonly '@_encoding': 'UTF-8';
  };
  readonly AvailabilityQueryRQ: AvailabilityQueryRQ;
}

export interface NemoPriceRS {
  readonly '@_Amount': string;
  readonly '@_Currency': string;
}

export interface NemoBoardTypeRS {
  readonly '@_Code': string;
  readonly '@_Description': string;
}

export interface NemoRoomRateRS {
  readonly '@_RoomSequence': string;
  readonly RoomType: string;
  readonly BoardType: NemoBoardTypeRS;
}

export interface NemoRateRS {
  readonly TripProductID: string;
  readonly RateClass: string;
  readonly Price: NemoPriceRS;
  readonly RoomRates: { readonly RoomRate: NemoRoomRateRS | readonly NemoRoomRateRS[] };
  readonly CancellationPolicy?: {
    readonly Refundable?: string;
    readonly Deadline?: string;
  };
}

export interface NemoHotelRS {
  readonly HotelCode: string;
  readonly HotelName: string;
  readonly HotelRating: string;
  readonly Address?: {
    readonly Street?: string;
    readonly City?: string;
    readonly PostalCode?: string;
    readonly CountryCode?: string;
  };
  readonly Position?: {
    readonly Latitude?: string;
    readonly Longitude?: string;
  };
  readonly Rates?: { readonly Rate: NemoRateRS | readonly NemoRateRS[] };
}

export interface AvailabilityQueryRS {
  readonly '@_TransactionId': string;
  readonly '@_Status': string;
  readonly Pagination?: { readonly TotalItems?: string };
  readonly Hotels?: { readonly Hotel: NemoHotelRS | readonly NemoHotelRS[] };
}

export interface NemoErrorRS {
  readonly '@_TransactionId'?: string;
  readonly Error: {
    readonly '@_Code': string;
    readonly '@_Message': string;
    readonly '@_Type'?: string;
    readonly Details?: string;
  };
}
