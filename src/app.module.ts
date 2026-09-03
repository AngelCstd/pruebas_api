import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module';
import { HotelModule } from './modules/hotel/hotel.module';

@Module({ imports: [HealthModule, HotelModule] })
export class AppModule {}
