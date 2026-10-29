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
    const rooms = dto.rooms.map((room) => {
      const roomPassengers = dto.passengers.filter((p) => p.roomSequence === room.roomSequence);
      const passengersXml = roomPassengers.map((passenger) => {
        const ageType = passenger.ageType === PassengerAgeType.ADT ? 'ADT' : passenger.ageType === PassengerAgeType.CHD ? 'CHD' : 'INF';
        return `<Passenger AgeType="${ageType}" RoomSequence="${room.roomSequence}"${passenger.age !== undefined ? ` Age="${passenger.age}"` : ''}/>`;
      }).join('');
      return `<Room RoomSequence="${room.roomSequence}"><Passengers>${passengersXml}</Passengers></Room>`;
    }).join('');

    const rootPassengersXml = dto.passengers.map((passenger) => {
      const nemoAge = NEMO_AGE_TYPES[passenger.ageType] ?? 'NMO.GBL.AGT.ADT';
      return `<Passenger AgeType="${nemoAge}" RoomSequence="${passenger.roomSequence}"${passenger.age !== undefined ? ` Age="${passenger.age}"` : ''}/>`;
    }).join('');

    const hotelNameTag = dto.hotelName ? `<HotelName>${dto.hotelName}</HotelName>` : '';
    const ratingsTag = (dto.ratings !== undefined || dto.minRating !== undefined || dto.maxRating !== undefined) && ratings.length
      ? `<Ratings>${ratings.join(',')}</Ratings>`
      : '';
    const hotelCodesTag = dto.hotelCodeList?.length ? `<HotelCodeList>${dto.hotelCodeList.join(',')}</HotelCodeList>` : '';
    const boardTypesTag = dto.boardTypes?.length ? `<BoardTypes>${dto.boardTypes.join(',')}</BoardTypes>` : '';

    return `<?xml version="1.0" encoding="UTF-8"?><AvailabilityQueryRQ TransactionId="${transactionId}" TransactionMode="Synchronous"><GeneralParameters><PreferedLanguage LanguageCode="ES"/><PreferedCurrency CurrencyCode="MXN"/></GeneralParameters><Trips><Trip><Destination>${dto.destinationId}</Destination><ProductsParameters><HotelsParameters><Criterion><CheckIn>${dto.checkIn}</CheckIn><CheckOut>${dto.checkOut}</CheckOut><Rooms>${rooms}</Rooms><Availability>CNF</Availability>${hotelNameTag}${ratingsTag}${hotelCodesTag}${boardTypesTag}</Criterion></HotelsParameters></ProductsParameters></Trip></Trips><Passengers>${rootPassengersXml}</Passengers></AvailabilityQueryRQ>`;
  }

  // Nemo valida/cotiza cancelación por `Hotel` dentro de `Products><Hotels>`, no por un
  // `TripProductID` plano en la raíz como se asumía antes (confirmado contra el proyecto SoapUI
  // real de PriceSurfer: PS_WebServices-soapui-project.xml, test steps "ValidateProductAvailability"
  // y "CancellationFees-PreBooking"). Sin esta anidación, Nemo respondía NullPointerException.
  public buildValidationRequest(dto: { readonly tripProductId: string }): string {
    return this.buildHotelProductRequest('AvailabilityValidationRQ', { TripProductID: dto.tripProductId });
  }

  public buildCancellationFeesRequest(dto: { readonly tripProductId: string }): string {
    return this.buildHotelProductRequest('CancellationFeesQueryRQ', {
      TripProductID: dto.tripProductId,
      ShowHotelInformation: 'false',
    });
  }

  private buildHotelProductRequest(root: string, hotelAttributes: Record<string, string>): string {
    const attributes: Record<string, string> = {};
    for (const [key, value] of Object.entries(hotelAttributes)) attributes[`@_${key}`] = value;
    return this.xmlBuilder.build({
      '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
      [root]: { Products: { Hotels: { Hotel: attributes } } },
    });
  }

  // El detalle de hotel se pide por `HotelDetailId` (código que Nemo asigna por resultado de
  // búsqueda, ej. "B7H-29NOV-4ND"), no por el `hotelCode` numérico que usamos para enrutar entre
  // proveedores (ej. "3416171") — son identificadores distintos. Confirmado contra el proyecto
  // SoapUI real. `hotelDetailId` llega desde el resultado de búsqueda (ver QueryHotelDetailsDto);
  // si no está disponible, se usa `hotelCode` como mejor esfuerzo (seguirá fallando contra Nemo,
  // pero preserva el comportamiento anterior para mock/convenio que no pasan por este builder).
  public buildHotelDetailsRequest(hotelDetailId: string, dto: QueryHotelDetailsDto): string {
    return this.xmlBuilder.build({
      '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
      AdditionalInfoQueryRQ: {
        GeneralParameters: {
          PreferedLanguage: { '@_LanguageCode': dto.language ?? 'es' },
          PreferedCurrency: { '@_CurrencyCode': 'USD' },
        },
        Products: { Hotels: { Hotel: { '@_HotelDetailId': hotelDetailId } } },
      },
    });
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
    return {
      '@_Title': passenger.title ?? '',
      '@_FirstName': passenger.firstName ?? '',
      '@_LastName': passenger.lastName ?? '',
    };
  }

  private buildDocument(root: string, transactionId: string, content: Record<string, unknown>): string {
    return this.xmlBuilder.build({ '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
      [root]: { '@_TransactionId': transactionId, ...content } });
  }

}
