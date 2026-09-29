/**
 * Destino geográfico del catálogo `hotel_destinations` (Nemo Group, Sección 3.2).
 * El mismo `destinationId` existe una vez por idioma (`languageId`).
 */
export interface DestinationItem {
  readonly destinationId: string;
  readonly languageId: string;
  readonly city: string | null;
  readonly state: string | null;
  readonly stateId: string | null;
  readonly country: string | null;
  readonly countryId: string | null;
  readonly label: string | null;
}
