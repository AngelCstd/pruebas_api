import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseEnumPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CatalogQueryDto, ProviderQueryDto } from '../dto/catalog-query.dto';
import { SearchHotelsDto } from '../dto/search-hotels.dto';
import { ProviderType } from '../enums/provider.enum';
import {
  HotelCatalogItem,
  HotelCatalogResult,
  HotelDestination,
  RoomTypeOption,
} from '../models/hotel-catalog.model';
import { HotelSearchResult } from '../models/hotel.model';
import { HotelService } from '../services/hotel.service';

@Controller('hotels')
export class HotelController {
  public constructor(private readonly hotelService: HotelService) {}

  @Get('catalog')
  public listCatalog(@Query() query: CatalogQueryDto): HotelCatalogResult {
    return this.hotelService.listCatalog(query);
  }

  @Get('catalog/:hotelCode')
  public getHotelByCode(
    @Param('hotelCode') hotelCode: string,
    @Query() query: ProviderQueryDto,
  ): HotelCatalogItem {
    return this.hotelService.getHotelByCode(hotelCode, query.provider);
  }

  @Get('destinations')
  public listDestinations(@Query() query: ProviderQueryDto): readonly HotelDestination[] {
    return this.hotelService.listDestinations(query.provider);
  }

  @Get('room-types')
  public listRoomTypes(@Query() query: ProviderQueryDto): readonly RoomTypeOption[] {
    return this.hotelService.listRoomTypes(query.provider);
  }

  @Post('search')
  public searchHotels(
    @Body() dto: SearchHotelsDto,
    @Query('provider', new DefaultValuePipe(ProviderType.MOCK), new ParseEnumPipe(ProviderType))
    provider: ProviderType,
  ): Promise<HotelSearchResult> {
    return this.hotelService.searchHotels(dto, provider);
  }
}
