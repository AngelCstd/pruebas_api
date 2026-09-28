import { Module } from '@nestjs/common';
import { CatalogController } from '../controllers/catalog.controller';
import { CATALOG_REPOSITORY } from '../repositories/catalog.repository.interface';
import { LocalCatalogRepository } from '../repositories/local-catalog.repository';
import { CatalogService } from '../services/catalog.service';

/**
 * Módulo de Catálogos y Diccionarios Maestros de Nemo.
 *
 * MIGRACIÓN A POSTGRESQL / PRISMA:
 * Siguiendo la convención descrita en CLAUDE.md:
 * Para cambiar a la base de datos real, basta con crear `PrismaCatalogRepository`
 * y reemplazar `useClass: LocalCatalogRepository` por `useClass: PrismaCatalogRepository`.
 */
@Module({
  controllers: [CatalogController],
  providers: [
    CatalogService,
    {
      provide: CATALOG_REPOSITORY,
      useClass: LocalCatalogRepository,
    },
  ],
  exports: [CatalogService, CATALOG_REPOSITORY],
})
export class CatalogModule {}
