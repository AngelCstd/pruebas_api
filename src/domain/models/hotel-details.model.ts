import { HotelAddress } from './hotel.model';

export interface HotelDetailsResult {
  hotelCode: string;
  /** Campos opcionales de enriquecimiento (solo el proveedor mock los rellena). */
  hotelName?: string;
  rating?: number;
  propertyType?: string;
  address?: HotelAddress;
  latitude?: number;
  longitude?: number;
  reviewScore?: number;
  reviewCount?: number;
  policies?: string[];
  description: string;
  checkInTime: string;
  checkOutTime: string;
  amenities: { code: string; name: string }[];
  images: { category: string; url: string }[];
}
