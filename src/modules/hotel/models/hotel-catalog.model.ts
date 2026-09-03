export interface HotelAmenity {
  readonly code: string;
  readonly name: string;
}

export interface HotelImage {
  readonly category: string;
  readonly url: string;
}

export interface HotelCatalogItem {
  readonly hotelCode: string;
  readonly destinationId: string;
  readonly hotelName: string;
  readonly rating: number;
  readonly address: {
    readonly street: string;
    readonly city: string;
    readonly postalCode: string;
    readonly countryCode: string;
  };
  readonly latitude: number;
  readonly longitude: number;
  readonly description: string;
  readonly checkInTime: string;
  readonly checkOutTime: string;
  readonly amenities: readonly HotelAmenity[];
  readonly images: readonly HotelImage[];
  readonly roomTypes: readonly string[];
}

export interface HotelCatalogResult {
  readonly source: 'mock';
  readonly totalItems: number;
  readonly hotels: readonly HotelCatalogItem[];
}

export interface HotelDestination {
  readonly destinationId: string;
  readonly name: string;
  readonly countryCode: string;
  readonly hotelCount: number;
}

export interface RoomTypeOption {
  readonly code: string;
  readonly name: string;
  readonly maximumGuests: number;
}
