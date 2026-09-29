import { HotelAddress } from '../domain/models/hotel.model';

/**
 * Fixtures deterministas del proveedor MOCK.
 * Los datos dependen solo del `destinationId`, por lo que una misma búsqueda siempre devuelve los mismos hoteles.
 * Las coordenadas de destinos distintos al fallback son ficticias (solo para demos).
 */

export type MockLanguage = 'es' | 'en';

export interface MockPlace {
  readonly destinationId: string;
  readonly city: string;
  readonly country: string;
  readonly countryCode: string;
  readonly label: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly currency: string;
  readonly isFallback: boolean;
}

export interface MockRateTemplate {
  readonly rateClass: string;
  readonly pricePerNight: number;
  readonly boardCode: 'RO' | 'BB' | 'HB';
  readonly boardDescription: string;
  readonly refundable: boolean;
}

export interface MockImage {
  readonly category: string;
  readonly url: string;
}

export interface MockHotelProfile {
  readonly hotelCode: string;
  readonly hotelName: string;
  readonly propertyType: string;
  readonly rating: number;
  readonly address: HotelAddress;
  readonly latitude: number;
  readonly longitude: number;
  readonly reviewScore: number;
  readonly reviewCount: number;
  readonly distanceToCenterKm: number;
  readonly amenityCodes: readonly string[];
  readonly images: readonly MockImage[];
  readonly rateTemplates: readonly MockRateTemplate[];
}

interface HotelTemplate {
  readonly name: string;
  readonly propertyType: string;
  readonly rating: number;
  readonly street: string;
  readonly rates: readonly MockRateTemplate[];
}

export const MOCK_HOTEL_CODE_PATTERN = /^MOCK-(.+)-(00[1-8])$/;

export const FALLBACK_PLACE: MockPlace = {
  destinationId: 'fallback',
  city: 'Madrid',
  country: 'España',
  countryCode: 'ES',
  label: 'Madrid (offline fixture)',
  latitude: 40.443912,
  longitude: -3.690831,
  currency: 'EUR',
  isFallback: true,
};

const EUR_COUNTRIES: ReadonlySet<string> = new Set([
  'ES', 'FR', 'IT', 'DE', 'PT', 'NL', 'BE', 'AT', 'IE', 'GR', 'FI', 'LU', 'MT', 'CY', 'SK', 'SI', 'EE', 'LV', 'LT', 'HR',
]);

const AMENITY_NAMES: Readonly<Record<string, Readonly<Record<MockLanguage, string>>>> = {
  WIFI: { es: 'Wi-Fi gratuito', en: 'Free Wi-Fi' },
  AC: { es: 'Aire acondicionado', en: 'Air conditioning' },
  PARK: { es: 'Aparcamiento privado', en: 'Private parking' },
  REST: { es: 'Restaurante', en: 'Restaurant' },
  GYM: { es: 'Gimnasio', en: 'Fitness center' },
  POOL: { es: 'Piscina climatizada', en: 'Heated pool' },
  BAR: { es: 'Bar y terraza', en: 'Bar & terrace' },
  SPA: { es: 'Spa & Wellness', en: 'Spa & Wellness' },
  ROOMSVC: { es: 'Servicio a la habitación 24h', en: '24h room service' },
  AIRPORT: { es: 'Traslado al aeropuerto', en: 'Airport shuttle' },
};

const AMENITIES_BY_RATING: Readonly<Record<number, readonly string[]>> = {
  2: ['WIFI', 'AC', 'PARK', 'REST'],
  3: ['WIFI', 'AC', 'PARK', 'REST', 'GYM'],
  4: ['WIFI', 'AC', 'PARK', 'REST', 'GYM', 'POOL', 'BAR'],
  5: ['WIFI', 'AC', 'PARK', 'REST', 'GYM', 'POOL', 'BAR', 'SPA', 'ROOMSVC', 'AIRPORT'],
};

const IMAGE_POOL: readonly string[] = [
  'photo-1566073771259-6a8506099945',
  'photo-1611892440504-42a792e24d32',
  'photo-1576013551627-0cc20b96c2a7',
  'photo-1551882547-ff40c63fe5fa',
  'photo-1564501049412-61c2a3083791',
  'photo-1520250497591-112f2f40a3f4',
  'photo-1542314831-068cd1dbfeeb',
  'photo-1445019980597-93fa8acb246c',
];
const IMAGE_CATEGORIES: readonly string[] = ['Exterior', 'Room', 'Pool', 'Lobby'];

const ROOM_FACTORS: Readonly<Record<string, number>> = {
  'NMO.HTL.RMT.SGL': 0.8,
  'NMO.HTL.RMT.DBL': 1,
  'NMO.HTL.RMT.TPL': 1.25,
  'NMO.HTL.RMT.QUA': 1.5,
  'NMO.HTL.RMT.QUD': 1.5,
};

const BB = { boardCode: 'BB', boardDescription: 'Bed & Breakfast' } as const;
const RO = { boardCode: 'RO', boardDescription: 'Room Only' } as const;
const HB = { boardCode: 'HB', boardDescription: 'Half Board' } as const;

const HOTEL_TEMPLATES: readonly HotelTemplate[] = [
  { name: 'Grand Hotel Plaza', propertyType: 'Hotel', rating: 5, street: 'Grand Avenue', rates: [
    { rateClass: 'Standard', pricePerNight: 172.5, ...BB, refundable: true },
    { rateClass: 'NonRefundable', pricePerNight: 148, ...RO, refundable: false },
  ] },
  { name: 'Hotel Resort & Spa', propertyType: 'Resort', rating: 4, street: 'Seaside Promenade', rates: [
    { rateClass: 'Flexible', pricePerNight: 139, ...HB, refundable: true },
    { rateClass: 'AdvancePurchase', pricePerNight: 121.5, boardCode: 'BB', boardDescription: 'Breakfast Included', refundable: false },
  ] },
  { name: 'Boutique Suites {city}', propertyType: 'Boutique', rating: 4, street: 'Old Town Street', rates: [
    { rateClass: 'Standard', pricePerNight: 126, ...BB, refundable: true },
    { rateClass: 'NonRefundable', pricePerNight: 104, ...RO, refundable: false },
    { rateClass: 'Flexible', pricePerNight: 149, ...HB, refundable: true },
  ] },
  { name: 'Hotel Central {city}', propertyType: 'Hotel', rating: 3, street: 'Main Square', rates: [
    { rateClass: 'Standard', pricePerNight: 92, ...BB, refundable: true },
    { rateClass: 'NonRefundable', pricePerNight: 76, ...RO, refundable: false },
  ] },
  { name: 'Palacio Real {city}', propertyType: 'Hotel', rating: 5, street: 'Royal Boulevard', rates: [
    { rateClass: 'Standard', pricePerNight: 214, ...BB, refundable: true },
    { rateClass: 'Flexible', pricePerNight: 255, ...HB, refundable: true },
    { rateClass: 'NonRefundable', pricePerNight: 181, ...RO, refundable: false },
  ] },
  { name: 'Casa del Mar', propertyType: 'Boutique', rating: 3, street: 'Harbour Road', rates: [
    { rateClass: 'Standard', pricePerNight: 84, ...BB, refundable: true },
    { rateClass: 'NonRefundable', pricePerNight: 69, ...RO, refundable: false },
  ] },
  { name: '{city} Business Inn', propertyType: 'Hotel', rating: 3, street: 'Station Road', rates: [
    { rateClass: 'Standard', pricePerNight: 78, ...RO, refundable: true },
    { rateClass: 'AdvancePurchase', pricePerNight: 66, ...BB, refundable: false },
  ] },
  { name: 'Hostal Los Naranjos', propertyType: 'Hostal', rating: 2, street: 'Orange Lane', rates: [
    { rateClass: 'Standard', pricePerNight: 55, ...RO, refundable: true },
    { rateClass: 'NonRefundable', pricePerNight: 47, ...RO, refundable: false },
  ] },
];

/** Hash de texto a entero de 32 bits (FNV-1a). */
function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Generador pseudoaleatorio determinista (mulberry32). */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function buildPlace(
  destinationId: string,
  city: string,
  country: string,
  countryCode: string,
  label: string,
): MockPlace {
  const random = createRandom(hashString(`place:${destinationId}`));
  return {
    destinationId,
    city,
    country,
    countryCode,
    label,
    latitude: round(random() * 100 - 50, 6),
    longitude: round(random() * 300 - 150, 6),
    currency: EUR_COUNTRIES.has(countryCode) ? 'EUR' : 'USD',
    isFallback: false,
  };
}

export function amenityName(code: string, language: MockLanguage): string {
  return AMENITY_NAMES[code]?.[language] ?? code;
}

export function roomFactor(roomType: string): number {
  return ROOM_FACTORS[roomType] ?? 1;
}

function imageUrl(id: string, width: number): string {
  return `https://images.unsplash.com/${id}?w=${width}`;
}

export function buildHotelProfiles(destinationId: string, place: MockPlace): readonly MockHotelProfile[] {
  return HOTEL_TEMPLATES.map((template, index) => {
    const random = createRandom(hashString(`hotel:${destinationId}:${index}`));
    const priceFactor = place.isFallback ? 1 : round(0.9 + random() * 0.25, 2);
    const scoreBase = 6.4 + template.rating * 0.5;
    const images: MockImage[] = IMAGE_CATEGORIES.map((category, position) => ({
      category,
      url: imageUrl(IMAGE_POOL[(index + position * 2) % IMAGE_POOL.length], 1200),
    }));
    const number = 1 + Math.floor(random() * 240);
    return {
      hotelCode: `MOCK-${destinationId}-00${index + 1}`,
      hotelName: template.name.replace('{city}', place.city),
      propertyType: template.propertyType,
      rating: template.rating,
      address: {
        street: `${number} ${template.street}`,
        city: place.city,
        postalCode: place.isFallback && index === 0 ? '28046' : String(10000 + Math.floor(random() * 89999)),
        countryCode: place.countryCode,
      },
      latitude: round(place.latitude + (random() - 0.5) * 0.04, 6),
      longitude: round(place.longitude + (random() - 0.5) * 0.04, 6),
      reviewScore: round(Math.min(9.8, scoreBase + random() * 1.2), 1),
      reviewCount: 120 + Math.floor(random() * 4600),
      distanceToCenterKm: round(0.2 + random() * 6, 1),
      amenityCodes: AMENITIES_BY_RATING[template.rating] ?? AMENITIES_BY_RATING[3],
      images,
      rateTemplates: template.rates.map((rate) => ({ ...rate, pricePerNight: round(rate.pricePerNight * priceFactor, 2) })),
    };
  });
}

export function buildDescription(profile: MockHotelProfile, place: MockPlace, language: MockLanguage): string {
  const stars = '★'.repeat(profile.rating);
  if (language === 'es') {
    return `${profile.propertyType} de ${profile.rating} estrellas (${stars}) en ${place.city}, ${place.country}. `
      + `A ${profile.distanceToCenterKm} km del centro, con habitaciones luminosas y desayuno disponible. `
      + `Valoración de huéspedes: ${profile.reviewScore}/10 (${profile.reviewCount} opiniones).`;
  }
  return `${profile.rating}-star ${profile.propertyType.toLowerCase()} (${stars}) in ${place.city}, ${place.country}. `
    + `${profile.distanceToCenterKm} km from the center, with bright rooms and breakfast available. `
    + `Guest rating: ${profile.reviewScore}/10 (${profile.reviewCount} reviews).`;
}

export function buildPolicies(profile: MockHotelProfile, language: MockLanguage): string[] {
  const premium = profile.rating >= 4;
  return language === 'es'
    ? [
      'Niños de 0 a 12 años se alojan gratis compartiendo habitación con sus padres.',
      premium ? 'Se admiten mascotas pequeñas (suplemento por noche).' : 'No se admiten mascotas.',
      'Se requiere tarjeta de crédito como garantía al hacer el check-in.',
    ]
    : [
      'Children aged 0–12 stay free when sharing a room with their parents.',
      premium ? 'Small pets are allowed (nightly surcharge).' : 'Pets are not allowed.',
      'A credit card is required as a guarantee at check-in.',
    ];
}

export function checkTimes(profile: MockHotelProfile): { checkInTime: string; checkOutTime: string } {
  return profile.rating <= 2
    ? { checkInTime: '14:00', checkOutTime: '11:00' }
    : { checkInTime: '15:00', checkOutTime: '12:00' };
}

export function thumbnailUrl(profile: MockHotelProfile): string {
  const source = profile.images[0];
  return source ? source.url.replace('w=1200', 'w=400') : '';
}
