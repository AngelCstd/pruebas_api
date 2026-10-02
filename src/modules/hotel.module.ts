import { Module } from '@nestjs/common';
import { NemoXmlAdapter } from '../adapters/nemo/nemo-xml.adapter';
import { NemoXmlBuilder } from '../adapters/nemo/nemo-xml.builder';
import { NemoXmlParser } from '../adapters/nemo/nemo-xml.parser';
import { HotelController } from '../controllers/hotel.controller';
import { CareDirectoryController } from '../controllers/care-directory.controller';
import { DestinationModule } from './destination.module';
import { CONVENIO_HOTEL_REPOSITORY } from '../repositories/convenio-hotel.repository.interface';
import { SupabaseConvenioHotelRepository } from '../repositories/supabase-convenio-hotel.repository';
import { BOOKING_OPERATION_REPOSITORY } from '../repositories/booking-operation.repository.interface';
import { SupabaseBookingOperationRepository } from '../repositories/supabase-booking-operation.repository';
import { BookingApplicationService } from '../services/booking-application.service';
import { CareDirectoryService } from '../services/care-directory.service';
import { CARE_RESERVATION_REPOSITORY } from '../repositories/care-reservation.repository.interface';
import { SupabaseCareReservationRepository } from '../repositories/supabase-care-reservation.repository';
import { HotelService } from '../services/hotel.service';
import { CompositeHotelStrategy } from '../strategies/composite-hotel.strategy';
import { ConvenioHotelStrategy } from '../strategies/convenio-hotel.strategy';
import { HotelStrategyFactory } from '../strategies/hotel-strategy.factory';
import { MockHotelStrategy } from '../strategies/mock-hotel.strategy';
import { NemoHotelStrategy } from '../strategies/nemo-hotel.strategy';
import { BookingProviderGuard } from '../guards/booking-provider.guard';

const providers = [
  HotelService,
  BookingApplicationService,
  CareDirectoryService,
  BookingProviderGuard,
  HotelStrategyFactory,
  MockHotelStrategy,
  NemoHotelStrategy,
  ConvenioHotelStrategy,
  CompositeHotelStrategy,
  // Para cambiar el almacenamiento de convenio, reemplazar useClass por otra implementación
  // de IConvenioHotelRepository.
  { provide: CONVENIO_HOTEL_REPOSITORY, useClass: SupabaseConvenioHotelRepository },
  { provide: BOOKING_OPERATION_REPOSITORY, useClass: SupabaseBookingOperationRepository },
  { provide: CARE_RESERVATION_REPOSITORY, useClass: SupabaseCareReservationRepository },
  NemoXmlAdapter,
  NemoXmlBuilder,
  NemoXmlParser,
];

@Module({
  imports: [DestinationModule],
  controllers: [HotelController, CareDirectoryController],
  providers,
  exports: providers,
})
export class HotelModule {}
