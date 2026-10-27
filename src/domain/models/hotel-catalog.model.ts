export interface HotelCatalogItem {
  /** Identificador a usar para pedir detalle (GET /hotels/:hotelCode/details). */
  hotelCode: string;
  // Convenio/mock sí traen estos campos listos para mostrar; Nemo real NO los da en este
  // endpoint (su /catalog/hotels/list solo regresa códigos, ver más abajo) — quedan opcionales.
  hotelName?: string;
  rating?: number;
  latitude?: number;
  longitude?: number;
  city?: string;
  country?: string;
  // Específicos del catálogo crudo de Nemo (confirmado contra la respuesta real, 2026-10-27):
  // <HotelCatalogQueryRS><Details><Hotels><Hotel SupplierId=".." SupplierHotelCode=".."
  // MphHotelId=".." DestinationId=".." HotelDetailId=".."/></Hotels><NextPageToken>..
  // </NextPageToken></Details></HotelCatalogQueryRS> — nunca trae nombre, rating, ni
  // HotelCount; se usa HotelDetailId como hotelCode (sin confirmar contra documentación real
  // de Nemo, es la inferencia más razonable dado el nombre del campo).
  supplierId?: string;
  supplierHotelCode?: string;
  mphHotelId?: string;
  destinationId?: string;
  hotelDetailId?: string;
}

export interface HotelCatalogResult {
  destinationCode?: string;
  destinationName?: string;
  hotelCount: number;
  /** Solo Nemo: hay más resultados, pedir la siguiente página con este token. */
  nextPageToken?: string;
  hotels: HotelCatalogItem[];
}
