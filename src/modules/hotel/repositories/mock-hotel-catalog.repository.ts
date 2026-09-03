import { Injectable } from '@nestjs/common';
import { CatalogQueryDto } from '../dto/catalog-query.dto';
import {
  HotelCatalogItem,
  HotelCatalogResult,
  HotelDestination,
  RoomTypeOption,
} from '../models/hotel-catalog.model';

const HOTELS: readonly HotelCatalogItem[] = [
  {
    hotelCode: 'MOCK-2262-001',
    destinationId: '2262',
    hotelName: 'Grand Hotel Plaza',
    rating: 5,
    address: {
      street: '120 Grand Avenue',
      city: 'Madrid',
      postalCode: '28046',
      countryCode: 'ES',
    },
    latitude: 40.443912,
    longitude: -3.690831,
    description: 'Hotel urbano de prueba con habitaciones ejecutivas y servicios de bienestar.',
    checkInTime: '15:00',
    checkOutTime: '12:00',
    amenities: [
      { code: 'WIFI', name: 'Wi-Fi' },
      { code: 'SPA', name: 'Spa' },
      { code: 'GYM', name: 'Gimnasio' },
    ],
    images: [
      { category: 'Exterior', url: 'https://example.com/mock-hotels/2262-001/exterior.jpg' },
      { category: 'Room', url: 'https://example.com/mock-hotels/2262-001/room.jpg' },
    ],
    roomTypes: ['NMO.HTL.RMT.SGL', 'NMO.HTL.RMT.DBL'],
  },
  {
    hotelCode: 'MOCK-2262-002',
    destinationId: '2262',
    hotelName: 'Puerta del Sol Suites',
    rating: 4,
    address: {
      street: '18 Calle Mayor',
      city: 'Madrid',
      postalCode: '28013',
      countryCode: 'ES',
    },
    latitude: 40.416933,
    longitude: -3.703542,
    description: 'Alojamiento mock céntrico para probar filtros y vistas de catálogo.',
    checkInTime: '14:00',
    checkOutTime: '11:00',
    amenities: [
      { code: 'WIFI', name: 'Wi-Fi' },
      { code: 'BREAKFAST', name: 'Desayuno' },
    ],
    images: [
      { category: 'Exterior', url: 'https://example.com/mock-hotels/2262-002/exterior.jpg' },
    ],
    roomTypes: ['NMO.HTL.RMT.DBL', 'NMO.HTL.RMT.TPL'],
  },
  {
    hotelCode: 'MOCK-BCN-001',
    destinationId: 'MOCK-BCN',
    hotelName: 'Hotel Resort & Spa',
    rating: 4,
    address: {
      street: '8 Seaside Promenade',
      city: 'Barcelona',
      postalCode: '08003',
      countryCode: 'ES',
    },
    latitude: 41.3851,
    longitude: 2.1734,
    description: 'Hotel costero simulado con spa, piscina y opciones familiares.',
    checkInTime: '15:00',
    checkOutTime: '11:00',
    amenities: [
      { code: 'WIFI', name: 'Wi-Fi' },
      { code: 'POOL', name: 'Piscina' },
      { code: 'SPA', name: 'Spa' },
    ],
    images: [
      { category: 'Pool', url: 'https://example.com/mock-hotels/bcn-001/pool.jpg' },
    ],
    roomTypes: ['NMO.HTL.RMT.DBL', 'NMO.HTL.RMT.TPL', 'NMO.HTL.RMT.QUD'],
  },
  {
    hotelCode: 'MOCK-CUN-001',
    destinationId: 'MOCK-CUN',
    hotelName: 'Caribe Family Resort',
    rating: 5,
    address: {
      street: '100 Boulevard Kukulcan',
      city: 'Cancún',
      postalCode: '77500',
      countryCode: 'MX',
    },
    latitude: 21.1215,
    longitude: -86.7576,
    description: 'Resort ficticio todo incluido para pruebas de catálogo internacional.',
    checkInTime: '15:00',
    checkOutTime: '12:00',
    amenities: [
      { code: 'WIFI', name: 'Wi-Fi' },
      { code: 'POOL', name: 'Piscina' },
      { code: 'BEACH', name: 'Acceso a playa' },
      { code: 'KIDS', name: 'Club infantil' },
    ],
    images: [
      { category: 'Beach', url: 'https://example.com/mock-hotels/cun-001/beach.jpg' },
    ],
    roomTypes: ['NMO.HTL.RMT.DBL', 'NMO.HTL.RMT.QUD'],
  },
];

const ROOM_TYPES: readonly RoomTypeOption[] = [
  { code: 'NMO.HTL.RMT.SGL', name: 'Individual', maximumGuests: 1 },
  { code: 'NMO.HTL.RMT.DBL', name: 'Doble', maximumGuests: 2 },
  { code: 'NMO.HTL.RMT.TPL', name: 'Triple', maximumGuests: 3 },
  { code: 'NMO.HTL.RMT.QUD', name: 'Cuádruple', maximumGuests: 4 },
];

@Injectable()
export class MockHotelCatalogRepository {
  public findAll(query: CatalogQueryDto): HotelCatalogResult {
    const hotels = HOTELS.filter((hotel) => this.matches(hotel, query));
    return { source: 'mock', totalItems: hotels.length, hotels };
  }

  public findByCode(hotelCode: string): HotelCatalogItem | undefined {
    return HOTELS.find((hotel) => hotel.hotelCode.toLowerCase() === hotelCode.toLowerCase());
  }

  public listDestinations(): readonly HotelDestination[] {
    const destinations = new Map<string, HotelDestination>();
    for (const hotel of HOTELS) {
      const current = destinations.get(hotel.destinationId);
      destinations.set(hotel.destinationId, {
        destinationId: hotel.destinationId,
        name: hotel.address.city,
        countryCode: hotel.address.countryCode,
        hotelCount: (current?.hotelCount ?? 0) + 1,
      });
    }
    return [...destinations.values()];
  }

  public listRoomTypes(): readonly RoomTypeOption[] {
    return ROOM_TYPES;
  }

  private matches(hotel: HotelCatalogItem, query: CatalogQueryDto): boolean {
    const includes = (value: string, search: string): boolean =>
      value.toLocaleLowerCase().includes(search.toLocaleLowerCase());

    return (!query.destinationId || hotel.destinationId === query.destinationId)
      && (!query.hotelName || includes(hotel.hotelName, query.hotelName))
      && (!query.city || includes(hotel.address.city, query.city))
      && (!query.countryCode || hotel.address.countryCode === query.countryCode)
      && (!query.minRating || hotel.rating >= query.minRating);
  }
}
