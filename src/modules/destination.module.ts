import { Module } from '@nestjs/common';
import { DestinationController } from '../controllers/destination.controller';
import { DESTINATION_REPOSITORY } from '../repositories/destination.repository.interface';
import { SupabaseDestinationRepository } from '../repositories/supabase-destination.repository';
import { DestinationService } from '../services/destination.service';

/**
 * Módulo de destinos (`hotel_destinations`).
 * Para cambiar el almacenamiento, reemplazar `useClass` por otra implementación
 * de `IDestinationRepository`.
 */
@Module({
  controllers: [DestinationController],
  providers: [
    DestinationService,
    {
      provide: DESTINATION_REPOSITORY,
      useClass: SupabaseDestinationRepository,
    },
  ],
  exports: [DestinationService, DESTINATION_REPOSITORY],
})
export class DestinationModule {}
