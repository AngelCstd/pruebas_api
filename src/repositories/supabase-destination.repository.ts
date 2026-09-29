import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SearchDestinationsDto } from '../domain/dtos/query-destinations.dto';
import { DestinationItem } from '../domain/models/destination.model';
import { IDestinationRepository } from './destination.repository.interface';

interface DestinationRow {
  readonly destination_id: string;
  readonly language_id: string;
  readonly city: string | null;
  readonly state: string | null;
  readonly state_id: string | null;
  readonly country: string | null;
  readonly country_id: string | null;
  readonly city_country: string | null;
}

const TABLE = 'hotel_destinations';
const COLUMNS = 'destination_id, language_id, city, state, state_id, country, country_id, city_country';

/**
 * Implementación del repositorio de destinos sobre Supabase (tabla `hotel_destinations`).
 * El cliente se crea de forma perezosa: sin credenciales el servicio arranca igual
 * y solo este endpoint responde 503.
 *
 * Para cambiar de almacenamiento, crear otra implementación de `IDestinationRepository`
 * y reemplazar el token `DESTINATION_REPOSITORY` en `DestinationModule`.
 */
@Injectable()
export class SupabaseDestinationRepository implements IDestinationRepository {
  private readonly logger = new Logger(SupabaseDestinationRepository.name);
  private client?: SupabaseClient;

  public async search(query: SearchDestinationsDto): Promise<readonly DestinationItem[]> {
    let request = this.getClient()
      .from(TABLE)
      .select(COLUMNS)
      .eq('language_id', query.language ?? 'es')
      .ilike('city_country', `%${this.escapeLike(query.q)}%`)
      .order('city_country', { ascending: true })
      .limit(query.limit ?? 10);

    if (query.countryId) {
      request = request.eq('country_id', query.countryId);
    }

    const { data, error } = await request.returns<DestinationRow[]>();
    if (error) {
      this.logger.error(`Destination search failed: ${error.message}`);
      throw new ServiceUnavailableException('Destination catalog is temporarily unavailable.');
    }
    return (data ?? []).map((row) => this.toItem(row));
  }

  private getClient(): SupabaseClient {
    if (this.client) {
      return this.client;
    }
    const url = process.env.SUPABASE_URL?.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!url || !key) {
      throw new ServiceUnavailableException('Destination catalog is not configured.');
    }
    this.client = createClient(url, key, { auth: { persistSession: false } });
    return this.client;
  }

  private escapeLike(value: string): string {
    return value.replace(/[\\%_]/g, (char) => `\\${char}`);
  }

  private toItem(row: DestinationRow): DestinationItem {
    return {
      destinationId: row.destination_id,
      languageId: row.language_id,
      city: row.city,
      state: row.state,
      stateId: row.state_id,
      country: row.country,
      countryId: row.country_id,
      label: row.city_country,
    };
  }
}
