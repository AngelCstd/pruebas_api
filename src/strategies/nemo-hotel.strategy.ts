import { Injectable } from '@nestjs/common';
import { NemoXmlAdapter } from '../adapters/nemo/nemo-xml.adapter';
import { SearchHotelsDto } from '../domain/dtos/search-hotels.dto';
import { HotelSearchResult } from '../domain/models/hotel.model';
import { HotelProviderStrategy } from './hotel-provider.strategy';

@Injectable()
export class NemoHotelStrategy implements HotelProviderStrategy {
  public constructor(private readonly nemoXmlAdapter: NemoXmlAdapter) {}

  public searchHotels(dto: SearchHotelsDto): Promise<HotelSearchResult> {
    return this.nemoXmlAdapter.searchHotels(dto);
  }
}
