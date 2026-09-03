import { Injectable } from '@nestjs/common';
import { SearchHotelsDto } from '../dto/search-hotels.dto';
import { NemoXmlAdapter } from '../infrastructure/nemo/nemo-xml.adapter';
import { HotelSearchResult } from '../models/hotel.model';
import { HotelProviderStrategy } from './hotel-provider.strategy';

@Injectable()
export class NemoHotelStrategy implements HotelProviderStrategy {
  public constructor(private readonly nemoXmlAdapter: NemoXmlAdapter) {}

  public searchHotels(dto: SearchHotelsDto): Promise<HotelSearchResult> {
    return this.nemoXmlAdapter.searchHotels(dto);
  }
}
