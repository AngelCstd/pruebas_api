import { QueryAmenitiesDto, QuerySuppliersDto, QueryAccommodationsDto } from '../domain/dtos/query-catalog.dto';
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  AMENITY_GROUPS_CATALOG,
  BOARD_TYPES_CATALOG,
  BOOKING_STATUSES_CATALOG,
  CANCELLATION_FEE_TYPES_CATALOG,
  PASSENGER_DOCUMENT_TYPES_CATALOG,
  ROOM_TYPES_CATALOG,
} from '../domain/constants/catalog-descriptions.constant';
import { STAR_RATINGS } from '../domain/constants/star-ratings.constant';
import {
  AccommodationItem,
  AmenityItem,
  BoardTypeItem,
  CatalogItem,
  PaginatedResult,
  RoomTypeItem,
  StarRatingItem,
  SupplierItem,
} from '../domain/models/catalog.model';
import { ICatalogRepository } from './catalog.repository.interface';

/**
 * Implementación EN MEMORIA del repositorio de catálogos.
 * Carga los diccionarios fuertemente tipados y los CSVs de semillas generados.
 *
 * NOTA ARQUITECTÓNICA:
 * Siguiendo las directrices de CLAUDE.md, esta implementación permite operar 100% offline
 * sin requerir una instancia viva de base de datos Postgres. Para migrar a PostgreSQL/Prisma,
 * solo es necesario crear un `PrismaCatalogRepository` que implemente `ICatalogRepository`
 * y reemplazar el token `CATALOG_REPOSITORY` en `CatalogModule`.
 */
@Injectable()
export class LocalCatalogRepository implements ICatalogRepository {
  private readonly logger = new Logger(LocalCatalogRepository.name);
  private readonly amenitiesCache: AmenityItem[] = [];
  private readonly suppliersCache: SupplierItem[] = [];
  private readonly accommodationsCache: AccommodationItem[] = [];

  public constructor() {
    this.loadSeedData();
  }

  public async getRoomTypes(): Promise<readonly RoomTypeItem[]> {
    return ROOM_TYPES_CATALOG;
  }

  public async getBoardTypes(): Promise<readonly BoardTypeItem[]> {
    return BOARD_TYPES_CATALOG;
  }

  public async getAmenityGroups(): Promise<readonly CatalogItem[]> {
    return AMENITY_GROUPS_CATALOG;
  }

  public async getAmenities(query: QueryAmenitiesDto): Promise<PaginatedResult<AmenityItem>> {
    const groupCode = query.groupCode?.trim().toUpperCase();
    const groupCodes = this.parseCodes(query.groupCodes?.toUpperCase());
    const items = this.amenitiesCache.filter((item) =>
      (!groupCode || item.groupCode.toUpperCase() === groupCode) &&
      (!groupCodes || groupCodes.has(item.groupCode.toUpperCase())),
    );
    return this.queryCatalog(items, query, (item) => item.description);
  }

  public async getSuppliers(query: QuerySuppliersDto): Promise<PaginatedResult<SupplierItem>> {
    return this.queryCatalog(this.suppliersCache, query, (item) => item.name);
  }

  public async getAccommodationTypes(
    query: QueryAccommodationsDto,
  ): Promise<PaginatedResult<AccommodationItem>> {
    return this.queryCatalog(this.accommodationsCache, query, (item) => item.description);
  }

  private parseCodes(value?: string): ReadonlySet<string> | undefined {
    return value === undefined ? undefined : new Set(
      value.split(',').map((code) => code.trim()).filter((code) => code.length > 0),
    );
  }

  private queryCatalog<T extends { readonly code: string }>(
    items: readonly T[],
    query: QuerySuppliersDto,
    getDescription: (item: T) => string,
  ): PaginatedResult<T> {
    const codes = this.parseCodes(query.codes);
    const search = query.search?.trim().toLowerCase();
    const filtered = items.filter((item) =>
      (!codes || codes.has(item.code)) &&
      (!search || item.code.toLowerCase().includes(search) ||
        getDescription(item).toLowerCase().includes(search)),
    );
    const direction = query.sortOrder === 'DESC' ? -1 : 1;
    filtered.sort((left, right) => direction * left.code.localeCompare(right.code));
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const total = filtered.length;
    const offset = (page - 1) * limit;
    return {
      data: filtered.slice(offset, offset + limit),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  public async getBookingStatuses(): Promise<readonly CatalogItem[]> {
    return BOOKING_STATUSES_CATALOG;
  }

  public async getPassengerDocumentTypes(): Promise<readonly CatalogItem[]> {
    return PASSENGER_DOCUMENT_TYPES_CATALOG;
  }

  public async getCancellationFeeTypes(): Promise<readonly CatalogItem[]> {
    return CANCELLATION_FEE_TYPES_CATALOG;
  }

  public async getStarRatings(): Promise<readonly StarRatingItem[]> {
    return STAR_RATINGS;
  }

  private loadSeedData(): void {
    const seedsDir = path.resolve(__dirname, '../../database/seeds');
    for (const name of ['amenities.csv', 'suppliers.csv', 'accommodations.csv']) {
      if (!fs.existsSync(path.join(seedsDir, name))) throw new Error(`Missing catalog seed: ${name}`);
    }

    // 1. Cargar amenities.csv
    const amenitiesPath = path.join(seedsDir, 'amenities.csv');
    if (fs.existsSync(amenitiesPath)) {
      const rows = this.parseCsv(amenitiesPath);
      for (const row of rows) {
        if (row.length >= 3) {
          this.amenitiesCache.push({
            groupCode: row[0],
            code: row[1],
            description: row[2],
          });
        }
      }
      this.logger.log(`Cargadas ${this.amenitiesCache.length} amenidades desde CSV.`);
    }

    // 2. Cargar suppliers.csv
    const suppliersPath = path.join(seedsDir, 'suppliers.csv');
    if (fs.existsSync(suppliersPath)) {
      const rows = this.parseCsv(suppliersPath);
      for (const row of rows) {
        if (row.length >= 2) {
          this.suppliersCache.push({
            code: row[0],
            name: row[1],
          });
        }
      }
      this.logger.log(`Cargados ${this.suppliersCache.length} proveedores mayoristas desde CSV.`);
    }

    // 3. Cargar accommodations.csv
    const accommodationsPath = path.join(seedsDir, 'accommodations.csv');
    if (fs.existsSync(accommodationsPath)) {
      const rows = this.parseCsv(accommodationsPath);
      for (const row of rows) {
        if (row.length >= 2) {
          this.accommodationsCache.push({
            code: row[0],
            description: row[1],
          });
        }
      }
      this.logger.log(`Cargados ${this.accommodationsCache.length} tipos de alojamiento desde CSV.`);
    }
  }

  private parseCsv(filePath: string): string[][] {
    const content = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    const records: string[][] = [];
    let row: string[] = [];
    let field = '';
    let quoted = false;
    for (let index = 0; index < content.length; index++) {
      const char = content[index];
      if (char === '"') {
        if (quoted && content[index + 1] === '"') { field += '"'; index++; }
        else quoted = !quoted;
      } else if (char === ',' && !quoted) {
        row.push(field.trim()); field = '';
      } else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && content[index + 1] === '\n') index++;
        row.push(field.trim());
        if (row.some((value) => value !== '')) records.push(row);
        row = []; field = '';
      } else field += char;
    }
    if (quoted) throw new Error(`Unterminated CSV field in ${filePath}`);
    if (field || row.length) { row.push(field.trim()); records.push(row); }
    const header = records.shift();
    if (!header || records.some((record) => record.length !== header.length || record.some((value) => !value))) {
      throw new Error(`Invalid catalog CSV: ${filePath}`);
    }
    return records;
  }
}
