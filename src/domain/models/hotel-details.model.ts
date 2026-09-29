export interface HotelDetailsResult {
  hotelCode: string;
  description: string;
  checkInTime: string;
  checkOutTime: string;
  amenities: { code: string; name: string }[];
  images: { category: string; url: string }[];
}
