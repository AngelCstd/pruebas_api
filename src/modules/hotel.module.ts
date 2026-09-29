import { Module } from '@nestjs/common';
import { NemoXmlAdapter } from '../adapters/nemo/nemo-xml.adapter';
import { NemoXmlBuilder } from '../adapters/nemo/nemo-xml.builder';
import { NemoXmlParser } from '../adapters/nemo/nemo-xml.parser';
import { HotelController } from '../controllers/hotel.controller';
import { DestinationModule } from './destination.module';
import { HotelService } from '../services/hotel.service';
import { HotelStrategyFactory } from '../strategies/hotel-strategy.factory';
import { MockHotelStrategy } from '../strategies/mock-hotel.strategy';
import { NemoHotelStrategy } from '../strategies/nemo-hotel.strategy';

const providers = [
  HotelService,
  HotelStrategyFactory,
  MockHotelStrategy,
  NemoHotelStrategy,
  NemoXmlAdapter,
  NemoXmlBuilder,
  NemoXmlParser,
];

@Module({
  imports: [DestinationModule],
  controllers: [HotelController],
  providers,
  exports: providers,
})
export class HotelModule {}
