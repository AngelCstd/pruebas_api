import { SearchHotelsDto } from '../domain/dtos/search-hotels.dto';
import { HotelSearchResult } from '../domain/models/hotel.model';

export interface HotelProviderStrategy {
  searchHotels(dto: SearchHotelsDto): Promise<HotelSearchResult>;
}
