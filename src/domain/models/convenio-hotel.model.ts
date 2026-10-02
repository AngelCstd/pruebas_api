/**
 * Hotel con convenio, tal como lo expone la vista `hotel_catalog_v`
 * (suppliers + organizations + supplier_hotel_profiles en la base de Care).
 */
export interface ConvenioHotel {
  readonly supplierId: string;
  readonly legacyId: string | null;
  readonly hotelName: string;
  readonly rating: number | null;
  readonly address: {
    readonly street: string;
    readonly city: string;
    readonly state: string | null;
    readonly postalCode: string;
    readonly countryCode: string;
  };
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly description: string | null;
  readonly photoUrls: readonly string[];
  /** Fecha (YYYY-MM-DD) hasta la que vale el convenio; null = sin vigencia registrada. */
  readonly agreementExpiresAt: string | null;
  readonly currency: string;
  /** Precio por noche y por cuarto (supuesto de MIA; ver rate_includes_tax). */
  readonly ratePerNight: number | null;
  /** null = no confirmado si el precio incluye impuestos. */
  readonly rateIncludesTax: boolean | null;
  readonly breakfastIncluded: boolean;
  readonly breakfastPrice: number | null;
  readonly availabilityNotes: string | null;
  readonly bookingNotes: string | null;
}
