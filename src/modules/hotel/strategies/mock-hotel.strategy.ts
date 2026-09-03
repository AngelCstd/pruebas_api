import { Injectable } from '@nestjs/common';
import { SearchHotelsDto } from '../dto/search-hotels.dto';
import { ProviderType } from '../enums/provider.enum';
import { HotelItem, HotelRate, HotelSearchResult } from '../models/hotel.model';
import { HotelProviderStrategy } from './hotel-provider.strategy';

@Injectable()
export class MockHotelStrategy implements HotelProviderStrategy {
  public async searchHotels(dto: SearchHotelsDto): Promise<HotelSearchResult> {
    const nights = this.calculateNights(dto.checkIn, dto.checkOut);
    const hotels = this.createHotels(dto, nights).filter((hotel) => {
      const nameMatches = dto.hotelName
        ? hotel.hotelName.toLowerCase().includes(dto.hotelName.toLowerCase())
        : true;
      const ratingMatches = dto.minRating ? hotel.rating >= dto.minRating : true;
      return nameMatches && ratingMatches;
    });

    return Promise.resolve({
      transactionId: this.createId('MOCK_SEARCH'),
      provider: ProviderType.MOCK,
      totalItems: hotels.length,
      hotels,
    });
  }

  private createHotels(dto: SearchHotelsDto, nights: number): HotelItem[] {
    return [
      {
        hotelCode: `MOCK-${dto.destinationId}-001`,
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
        rates: [
          this.createRate(dto, 'Standard', 172.5 * nights, 'EUR', 'Bed & Breakfast', 'BB', true),
          this.createRate(dto, 'NonRefundable', 148 * nights, 'EUR', 'Room Only', 'RO', false),
        ],
      },
      {
        hotelCode: `MOCK-${dto.destinationId}-002`,
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
        rates: [
          this.createRate(dto, 'Flexible', 139 * nights, 'EUR', 'Half Board', 'HB', true),
          this.createRate(dto, 'AdvancePurchase', 121.5 * nights, 'EUR', 'Breakfast Included', 'BB', false),
        ],
      },
    ];
  }

  private createRate(
    dto: SearchHotelsDto,
    rateClass: string,
    amount: number,
    currency: string,
    boardDescription: string,
    boardCode: string,
    refundable: boolean,
  ): HotelRate {
    const deadline = new Date(`${dto.checkIn}T00:00:00.000Z`);
    deadline.setUTCDate(deadline.getUTCDate() - 3);
    return {
      tripProductId: this.createId('MOCK_TRIP'),
      rateClass,
      amount: Number(amount.toFixed(2)),
      currency,
      roomRates: dto.rooms.map((room) => ({
        roomSequence: room.roomSequence,
        roomType: this.roomLabel(room.roomType),
        boardCode,
        boardDescription,
      })),
      cancellationPolicy: {
        refundable,
        ...(refundable ? { deadline: deadline.toISOString() } : {}),
      },
    };
  }

  private roomLabel(roomType: string): string {
    const labels: Readonly<Record<string, string>> = {
      'NMO.HTL.RMT.SGL': 'Classic Single Room',
      'NMO.HTL.RMT.DBL': 'Deluxe Double Room',
      'NMO.HTL.RMT.TPL': 'Superior Triple Room',
      'NMO.HTL.RMT.QUD': 'Family Quadruple Room',
    };
    return labels[roomType] ?? 'Standard Room';
  }

  private calculateNights(checkIn: string, checkOut: string): number {
    const millisecondsPerDay = 86_400_000;
    return Math.max(1, Math.round(
      (new Date(`${checkOut}T00:00:00.000Z`).getTime()
        - new Date(`${checkIn}T00:00:00.000Z`).getTime()) / millisecondsPerDay,
    ));
  }

  private createId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
  }
}
