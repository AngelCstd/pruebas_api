import { Module } from '@nestjs/common';
import { HotelModule } from './modules/hotel.module';

@Module({ imports: [HotelModule] })
export class AppModule {}
