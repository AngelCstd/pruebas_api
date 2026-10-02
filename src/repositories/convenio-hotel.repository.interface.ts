import { ConvenioHotel } from '../domain/models/convenio-hotel.model';

/**
 * Token de inyección de dependencias para el repositorio de hoteles con convenio.
 */
export const CONVENIO_HOTEL_REPOSITORY = Symbol('CONVENIO_HOTEL_REPOSITORY');

export interface IConvenioHotelRepository {
  /** Hoteles activos con tarifa cuya ciudad contiene `cityKey` (ver `normalizeCityKey`). */
  findByCity(tenantId: string, cityKey: string): Promise<readonly ConvenioHotel[]>;
  findBySupplierId(tenantId: string, supplierId: string): Promise<ConvenioHotel | null>;
}

/**
 * Ciudad en minúsculas y sin acentos. Debe coincidir con `suppliers.address_city_key`,
 * que llena el trigger `private.suppliers_set_keys` en la base.
 */
export function normalizeCityKey(value: string): string {
  return value.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
