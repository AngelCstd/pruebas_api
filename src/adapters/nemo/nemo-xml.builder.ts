import { CancelBookingDto } from '../../domain/dtos/cancel-booking.dto';
import { QueryHotelDetailsDto } from '../../domain/dtos/query-hotel-details.dto';
import { QueryHotelCatalogDto } from '../../domain/dtos/query-hotel-catalog.dto';
import { BookHotelDto, BookingPassengerDto } from '../../domain/dtos/book-hotel.dto';
import { Injectable } from '@nestjs/common';
import { XMLBuilder } from 'fast-xml-parser';
import { SearchHotelsDto } from '../../domain/dtos/search-hotels.dto';
import { PassengerAgeType } from '../../domain/enums/passenger-age-type.enum';
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
    const ratings = (dto.ratings ?? [1, 2, 3, 4, 5]).filter(
      (rating) => rating >= (dto.minRating ?? 1) && rating <= (dto.maxRating ?? 5),
    );
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
      ...(dto.ratings !== undefined || dto.minRating !== undefined || dto.maxRating !== undefined
        ? { Ratings: ratings.join(',') } : {}),
      ...(dto.hotelCodeList !== undefined ? { HotelCodeList: dto.hotelCodeList.join(',') } : {}),
      ...(dto.boardTypes !== undefined ? { BoardTypes: dto.boardTypes.join(',') } : {}),
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

  public buildValidationRequest(dto: { readonly tripProductId: string }, transactionId: string): string {
    return this.buildProductRequest('AvailabilityValidationRQ', dto.tripProductId, transactionId);
  }

  public buildCancellationFeesRequest(dto: { readonly tripProductId: string }, transactionId: string): string {
    return this.buildProductRequest('CancellationFeesQueryRQ', dto.tripProductId, transactionId);
  }

  private buildProductRequest(root: string, tripProductId: string, transactionId: string): string {
    return this.xmlBuilder.build({
      '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
      [root]: {
        '@_TransactionId': transactionId,
        '@_TransactionMode': 'Synchronous',
        TripProductID: tripProductId,
      },
    });
  }
  public buildHotelDetailsRequest(hotelCode: string, dto: QueryHotelDetailsDto, transactionId: string): string {
    return this.buildDocument('AdditionalInfoQueryRQ', transactionId, { HotelCode: hotelCode, LanguageCode: dto.language ?? 'es' });
  }

  public buildHotelCatalogRequest(dto: QueryHotelCatalogDto, transactionId: string): string {
    return this.buildDocument('HotelCatalogQueryRQ', transactionId, { DestinationCode: dto.destinationCode, ActiveOnly: String(dto.activeOnly ?? true) });
  }

  public buildBookingRequest(dto: BookHotelDto, transactionId: string): string {
    return this.buildDocument('BookingProductsRQ', transactionId, {
      '@_TransactionMode': 'Synchronous',
      TripProductID: dto.tripProductId, ClientReference: dto.clientReference,
      LeadPassenger: { ...this.passengerAttributes(dto.leadPassenger), '@_Email': dto.leadPassenger.email, '@_Phone': dto.leadPassenger.phone },
      Rooms: { Room: dto.rooms.map((room) => ({
        '@_RoomSequence': String(room.roomSequence),
        Guests: { Guest: room.guests.map((guest) => ({ ...this.passengerAttributes(guest), '@_Type': guest.type,
          ...(guest.age !== undefined ? { '@_Age': String(guest.age) } : {}) })) },
        ...(room.specialRequests !== undefined ? { SpecialRequests: room.specialRequests } : {}),
      })) },
      PaymentDetails: { '@_Method': 'CreditLimit' },
    });
  }

  public buildBookingDetailRequest(locator: string, transactionId: string): string {
    return this.buildDocument('BookingQueryRQ', transactionId, {
      '@_TransactionMode': 'Synchronous', BookingLocator: locator,
    });
  }

  public buildBookingCancellationRequest(locator: string, dto: CancelBookingDto, transactionId: string): string {
    return this.buildDocument('BookingCancellationRQ', transactionId, {
      '@_TransactionMode': 'Synchronous', BookingLocator: locator,
      ...(dto.reason !== undefined ? { Reason: dto.reason } : {}),
    });
  }

  private passengerAttributes(passenger: BookingPassengerDto): Record<string, string> {
    return { '@_Title': passenger.title, '@_FirstName': passenger.firstName, '@_LastName': passenger.lastName };
  }

  private buildDocument(root: string, transactionId: string, content: Record<string, unknown>): string {
    return this.xmlBuilder.build({ '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
      [root]: { '@_TransactionId': transactionId, ...content } });
  }

}
