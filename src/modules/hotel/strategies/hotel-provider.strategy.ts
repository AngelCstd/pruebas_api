import { SearchHotelsDto } from '../dto/search-hotels.dto';
import { HotelSearchResult } from '../models/hotel.model';

export interface HotelProviderStrategy {
  searchHotels(dto: SearchHotelsDto): Promise<HotelSearchResult>;
}
