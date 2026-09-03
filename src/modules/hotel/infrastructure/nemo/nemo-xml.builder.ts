import { Injectable } from '@nestjs/common';
import { XMLBuilder } from 'fast-xml-parser';
import { SearchHotelsDto } from '../../dto/search-hotels.dto';
import { PassengerAgeType } from '../../enums/passenger-age-type.enum';
import {
  AvailabilityQueryRQ,
  AvailabilityQueryRQDocument,
  NemoPassengerRequest,
} from './nemo-types';

const NEMO_AGE_TYPES: Readonly<Record<PassengerAgeType, string>> = {
  [PassengerAgeType.ADT]: 'NMO.GBL.AGT.ADT',
  [PassengerAgeType.CHD]: 'NMO.GBL.AGT.CHD',
  [PassengerAgeType.INF]: 'NMO.GBL.AGT.INF',
};

@Injectable()
export class NemoXmlBuilder {
  private readonly xmlBuilder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    format: true,
    suppressEmptyNode: true,
  });

  public buildAvailabilityRequest(dto: SearchHotelsDto, transactionId: string): string {
    const minRating = dto.minRating;
    const criterion: AvailabilityQueryRQ['HotelsParameters']['Criterion'] = {
      Rooms: {
        Room: dto.rooms.map((room) => ({
          '@_RoomType': room.roomType,
          '@_RoomSequence': String(room.roomSequence),
        })),
      },
      CheckIn: dto.checkIn,
      CheckOut: dto.checkOut,
      Availability: 'CNF',
      ...(dto.hotelName ? { HotelName: dto.hotelName } : {}),
      ...(minRating
        ? { Ratings: Array.from({ length: 6 - minRating }, (_, index) => index + minRating).join(',') }
        : {}),
    };

    const request: AvailabilityQueryRQ = {
      '@_TransactionId': transactionId,
      '@_TransactionMode': 'Synchronous',
      GeneralParameters: {
        PreferedLanguage: 'es',
        PreferedCurrency: 'EUR',
      },
      Trips: { Trip: { Destination: dto.destinationId } },
      HotelsParameters: { Criterion: criterion },
      Passengers: {
        Passenger: dto.passengers.map((passenger): NemoPassengerRequest => ({
          '@_AgeType': NEMO_AGE_TYPES[passenger.ageType],
          '@_RoomSequence': String(passenger.roomSequence),
          ...(passenger.age !== undefined ? { '@_Age': String(passenger.age) } : {}),
        })),
      },
      RequestSet: { FirstItem: '1', ItemsPerPage: '20' },
    };

    const document: AvailabilityQueryRQDocument = {
      '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
      AvailabilityQueryRQ: request,
    };
    return this.xmlBuilder.build(document);
  }
}
