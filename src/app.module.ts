import { Module } from '@nestjs/common';
import { CatalogModule } from './modules/catalog.module';
import { HotelModule } from './modules/hotel.module';

import { HealthModule } from './modules/health/health.module';

@Module({ imports: [HotelModule, CatalogModule, HealthModule] })
export class AppModule {}
