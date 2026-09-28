export interface HotelCatalogResult {
  destinationCode: string;
  destinationName: string;
  hotelCount: number;
  hotels: { hotelCode: string; hotelName: string; rating: number; latitude: number; longitude: number; city: string; country: string }[];
}
