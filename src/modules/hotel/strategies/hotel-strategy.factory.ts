import { Injectable } from '@nestjs/common';
import { ProviderType } from '../enums/provider.enum';
import { HotelProviderStrategy } from './hotel-provider.strategy';
import { MockHotelStrategy } from './mock-hotel.strategy';
import { NemoHotelStrategy } from './nemo-hotel.strategy';

@Injectable()
export class HotelStrategyFactory {
  public constructor(
    private readonly mockHotelStrategy: MockHotelStrategy,
    private readonly nemoHotelStrategy: NemoHotelStrategy,
  ) {}

  public resolve(provider: ProviderType = ProviderType.MOCK): HotelProviderStrategy {
    switch (provider) {
      case ProviderType.NEMO:
        return this.nemoHotelStrategy;
      case ProviderType.MOCK:
        return this.mockHotelStrategy;
    }
  }
}
