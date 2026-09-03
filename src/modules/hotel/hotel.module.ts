import { Module } from '@nestjs/common';
import { HotelController } from './controllers/hotel.controller';
import { NemoXmlAdapter } from './infrastructure/nemo/nemo-xml.adapter';
import { NemoXmlBuilder } from './infrastructure/nemo/nemo-xml.builder';
import { NemoXmlParser } from './infrastructure/nemo/nemo-xml.parser';
import { NemoReadService } from './infrastructure/nemo/nemo-read.service';
import { MockHotelCatalogRepository } from './repositories/mock-hotel-catalog.repository';
import { HotelService } from './services/hotel.service';
import { HotelStrategyFactory } from './strategies/hotel-strategy.factory';
import { MockHotelStrategy } from './strategies/mock-hotel.strategy';
import { NemoHotelStrategy } from './strategies/nemo-hotel.strategy';

const providers = [
  HotelService,
  HotelStrategyFactory,
  MockHotelStrategy,
  NemoHotelStrategy,
  NemoXmlAdapter,
  NemoXmlBuilder,
  NemoXmlParser,
  NemoReadService,
  MockHotelCatalogRepository,
];

@Module({
  controllers: [HotelController],
  providers,
  exports: providers,
})
export class HotelModule {}
