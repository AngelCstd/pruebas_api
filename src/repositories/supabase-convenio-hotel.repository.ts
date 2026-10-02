import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConvenioHotel } from '../domain/models/convenio-hotel.model';
import { IConvenioHotelRepository } from './convenio-hotel.repository.interface';

interface CatalogRow {
  readonly supplier_id: string;
  readonly legacy_id: string | null;
  readonly hotel_name: string;
  readonly agreement_expires_at: string | null;
  readonly address_street: string | null;
  readonly address_city: string | null;
  readonly address_state: string | null;
  readonly address_postal_code: string | null;
  readonly address_country_code: string | null;
  readonly availability_request_notes: string | null;
  readonly booking_request_notes: string | null;
  readonly rating: number | string | null;
  readonly latitude: number | string | null;
  readonly longitude: number | string | null;
  readonly description: string | null;
  readonly rate: number | string | null;
  readonly currency: string;
  readonly rate_includes_tax: boolean | null;
  readonly breakfast_included: boolean;
  readonly breakfast_price: number | string | null;
  readonly photo_urls: string[] | null;
}

const VIEW = 'hotel_catalog_v';
const COLUMNS = [
  'supplier_id', 'legacy_id', 'hotel_name', 'agreement_expires_at', 'address_street', 'address_city',
  'address_state', 'address_postal_code', 'address_country_code', 'availability_request_notes',
  'booking_request_notes', 'rating', 'latitude', 'longitude', 'description', 'rate', 'currency',
  'rate_includes_tax', 'breakfast_included', 'breakfast_price', 'photo_urls',
].join(', ');
const MAX_RESULTS = 200;

/**
 * Hoteles con convenio leídos de Supabase (vista `hotel_catalog_v`, ver database/hotel_catalog/).
 * Usa la llave de servicio, que se salta la RLS: por eso SIEMPRE se filtra por `tenant_id`
 * usando el tenant recibido en cada petición. Sin configuración, solo esta fuente responde 503.
 */
@Injectable()
export class SupabaseConvenioHotelRepository implements IConvenioHotelRepository {
  private readonly logger = new Logger(SupabaseConvenioHotelRepository.name);
  private client?: SupabaseClient;

  public async findByCity(tenantId: string, cityKey: string): Promise<readonly ConvenioHotel[]> {
    const { data, error } = await this.getClient()
      .from(VIEW)
      .select(COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('status', 'ACTIVE')
      .not('rate', 'is', null)
      .ilike('address_city_key', `%${this.escapeLike(cityKey)}%`)
      .order('hotel_name', { ascending: true })
      .limit(MAX_RESULTS)
      .returns<CatalogRow[]>();
    if (error) {
      this.logger.error(`Convenio hotel search failed: ${error.message}`);
      throw new ServiceUnavailableException('Convenio hotel catalog is temporarily unavailable.');
    }
    return (data ?? []).map((row) => this.toHotel(row));
  }

  public async findBySupplierId(tenantId: string, supplierId: string): Promise<ConvenioHotel | null> {
    const { data, error } = await this.getClient()
      .from(VIEW)
      .select(COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('status', 'ACTIVE')
      .eq('supplier_id', supplierId)
      .maybeSingle<CatalogRow>();
    if (error) {
      this.logger.error(`Convenio hotel lookup failed: ${error.message}`);
      throw new ServiceUnavailableException('Convenio hotel catalog is temporarily unavailable.');
    }
    return data ? this.toHotel(data) : null;
  }

  private getClient(): SupabaseClient {
    if (this.client) {
      return this.client;
    }
    const url = process.env.SUPABASE_URL?.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!url || !key) {
      throw new ServiceUnavailableException('Convenio hotel catalog is not configured.');
    }
    this.client = createClient(url, key, { auth: { persistSession: false } });
    return this.client;
  }

  private escapeLike(value: string): string {
    return value.replace(/[\\%_]/g, (char) => `\\${char}`);
  }

  private toNumber(value: number | string | null): number | null {
    if (value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private toHotel(row: CatalogRow): ConvenioHotel {
    return {
      supplierId: row.supplier_id,
      legacyId: row.legacy_id,
      hotelName: row.hotel_name,
      rating: this.toNumber(row.rating),
      address: {
        street: row.address_street ?? '',
        city: row.address_city ?? '',
        state: row.address_state,
        postalCode: row.address_postal_code ?? '',
        countryCode: row.address_country_code ?? '',
      },
      latitude: this.toNumber(row.latitude),
      longitude: this.toNumber(row.longitude),
      description: row.description,
      photoUrls: row.photo_urls ?? [],
      agreementExpiresAt: row.agreement_expires_at,
      currency: row.currency,
      ratePerNight: this.toNumber(row.rate),
      rateIncludesTax: row.rate_includes_tax,
      breakfastIncluded: row.breakfast_included,
      breakfastPrice: this.toNumber(row.breakfast_price),
      availabilityNotes: row.availability_request_notes,
      bookingNotes: row.booking_request_notes,
    };
  }
}
