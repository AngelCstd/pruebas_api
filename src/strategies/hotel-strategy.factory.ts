import { Injectable } from '@nestjs/common';
import { ProviderType } from '../domain/enums/provider.enum';
import { CompositeHotelStrategy } from './composite-hotel.strategy';
import { ConvenioHotelStrategy } from './convenio-hotel.strategy';
import { HotelProviderStrategy } from './hotel-provider.strategy';
import { MockHotelStrategy } from './mock-hotel.strategy';
import { NemoHotelStrategy } from './nemo-hotel.strategy';

@Injectable()
export class HotelStrategyFactory {
  public constructor(
    private readonly mockHotelStrategy: MockHotelStrategy,
    private readonly nemoHotelStrategy: NemoHotelStrategy,
    private readonly convenioHotelStrategy: ConvenioHotelStrategy,
    private readonly compositeHotelStrategy: CompositeHotelStrategy,
  ) {}

  public resolve(provider: ProviderType = ProviderType.MOCK): HotelProviderStrategy {
    switch (provider) {
      case ProviderType.NEMO:
        return this.nemoHotelStrategy;
      case ProviderType.MOCK:
        return this.mockHotelStrategy;
      case ProviderType.CONVENIO:
        return this.convenioHotelStrategy;
      case ProviderType.ALL:
        return this.compositeHotelStrategy;
    }
  }
}
