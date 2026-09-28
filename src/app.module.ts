import { Module } from '@nestjs/common';
import { CatalogModule } from './modules/catalog.module';
import { HotelModule } from './modules/hotel.module';

@Module({ imports: [HotelModule, CatalogModule] })
export class AppModule {}
