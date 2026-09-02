import { Body, Controller, DefaultValuePipe, ParseEnumPipe, Post, Query } from '@nestjs/common';
import { SearchHotelsDto } from '../domain/dtos/search-hotels.dto';
import { ProviderType } from '../domain/enums/provider.enum';
import { HotelSearchResult } from '../domain/models/hotel.model';
import { HotelService } from '../services/hotel.service';

@Controller('hotels')
export class HotelController {
  public constructor(private readonly hotelService: HotelService) {}

  @Post('search')
  public searchHotels(
    @Body() dto: SearchHotelsDto,
    @Query('provider', new DefaultValuePipe(ProviderType.MOCK), new ParseEnumPipe(ProviderType))
    provider: ProviderType,
  ): Promise<HotelSearchResult> {
    return this.hotelService.searchHotels(dto, provider);
  }
}
