import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  GoneException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { ProviderType } from '../../enums/provider.enum';
import { HotelItem, HotelRate, HotelRoomRate, HotelSearchResult } from '../../models/hotel.model';

type UnknownRecord = Record<string, unknown>;

@Injectable()
export class NemoXmlParser {
  private readonly xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
  });

  public parseAvailabilityResponse(xml: string, fallbackTransactionId: string): HotelSearchResult {
    const parsed: unknown = this.xmlParser.parse(xml);
    const document = this.asRecord(parsed, 'Nemo response document');
    const errorRoot = this.optionalRecord(document.ErrorRS);
    if (errorRoot) {
      this.throwNemoError(errorRoot);
    }

    const response = this.asRecord(document.AvailabilityQueryRS, 'AvailabilityQueryRS');
    const exceptions = this.optionalRecord(response.Exceptions);
    if (exceptions) {
      const notification = this.firstRecord(exceptions.Notification);
      const code = this.toNumber(notification.NotificationId, 1000);
      const message =
        this.optionalString(notification.NotificationDetailedMessage)
        ?? this.optionalString(notification.NotificationMessage)
        ?? 'Supplier exception';
      if (message.toLowerCase().includes('token') || message.toLowerCase().includes('auth')) {
        throw new UnauthorizedException(`Authentication with hotel supplier failed: ${message}`);
      }
      throw this.mapNemoError(code, message);
    }

    const nestedErrors = this.optionalRecord(response.Errors);
    if (nestedErrors) {
      const error = this.firstRecord(nestedErrors.Error);
      this.throwNemoError({ Error: error });
    }

    if (this.optionalString(response['@_Status'])?.toLowerCase() === 'error') {
      throw new BadGatewayException('Nemo returned an unsuccessful hotel search response.');
    }

    const hotelsContainer = this.optionalRecord(response.Hotels);
    const hotels = hotelsContainer
      ? this.toRecordArray(hotelsContainer.Hotel).map((hotel) => this.mapHotel(hotel))
      : [];
    const pagination = this.optionalRecord(response.Pagination);
    const totalItems = pagination
      ? this.toNumber(pagination.TotalItems, hotels.length)
      : hotels.length;

    return {
      transactionId: this.optionalString(response['@_TransactionId']) ?? fallbackTransactionId,
      provider: ProviderType.NEMO,
      totalItems,
      hotels,
    };
  }

  private mapHotel(hotel: UnknownRecord): HotelItem {
    const address = this.optionalRecord(hotel.Address) ?? {};
    const position = this.optionalRecord(hotel.Position) ?? {};
    const ratesContainer = this.optionalRecord(hotel.Rates);
    const rates = ratesContainer
      ? this.toRecordArray(ratesContainer.Rate).map((rate) => this.mapRate(rate))
      : [];
    const latitude = this.optionalNumber(position.Latitude);
    const longitude = this.optionalNumber(position.Longitude);

    return {
      hotelCode: this.requiredString(hotel.HotelCode, 'HotelCode'),
      hotelName: this.requiredString(hotel.HotelName, 'HotelName'),
      rating: this.toNumber(hotel.HotelRating, 0),
      address: {
        street: this.optionalString(address.Street) ?? '',
        city: this.optionalString(address.City) ?? '',
        postalCode: this.optionalString(address.PostalCode) ?? '',
        countryCode: this.optionalString(address.CountryCode) ?? '',
      },
      ...(latitude !== undefined ? { latitude } : {}),
      ...(longitude !== undefined ? { longitude } : {}),
      rates,
    };
  }

  private mapRate(rate: UnknownRecord): HotelRate {
    const price = this.asRecord(rate.Price, 'Price');
    const roomRatesContainer = this.optionalRecord(rate.RoomRates);
    const roomRates = roomRatesContainer
      ? this.toRecordArray(roomRatesContainer.RoomRate).map((roomRate) => this.mapRoomRate(roomRate))
      : [];
    const policy = this.optionalRecord(rate.CancellationPolicy);

    return {
      tripProductId: this.requiredString(rate.TripProductID, 'TripProductID'),
      rateClass: this.optionalString(rate.RateClass) ?? 'Standard',
      amount: this.toNumber(price['@_Amount'], 0),
      currency: this.optionalString(price['@_Currency']) ?? 'EUR',
      roomRates,
      cancellationPolicy: {
        refundable: (this.optionalString(policy?.Refundable) ?? 'false').toLowerCase() === 'true',
        ...(this.optionalString(policy?.Deadline)
          ? { deadline: this.optionalString(policy?.Deadline) }
          : {}),
      },
    };
  }

  private mapRoomRate(roomRate: UnknownRecord): HotelRoomRate {
    const boardType = this.optionalRecord(roomRate.BoardType) ?? {};
    return {
      roomSequence: this.toNumber(roomRate['@_RoomSequence'], 1),
      roomType: this.optionalString(roomRate.RoomType) ?? 'Standard Room',
      boardCode: this.optionalString(boardType['@_Code']) ?? 'RO',
      boardDescription: this.optionalString(boardType['@_Description']) ?? 'Room Only',
    };
  }

  private throwNemoError(root: UnknownRecord): never {
    const error = this.firstRecord(root.Error);
    const code = this.toNumber(error['@_Code'] ?? error.Code, 1000);
    const message = this.optionalString(error['@_Message'] ?? error.Message) ?? 'Unknown supplier error';
    const exception: HttpException = this.mapNemoError(code, message);
    throw exception;
  }

  private mapNemoError(code: number, message: string): HttpException {
    switch (code) {
      case 401:
        return new UnauthorizedException('Authentication with hotel supplier failed.');
      case 1106:
        return new ConflictException(`Rate price has changed upstream: ${message}`);
      case 5011:
        return new GoneException('The hotel rate session has expired. Please refresh search.');
      case 5000:
      case 1101:
      case 5120:
        return new NotFoundException('Requested hotel room or rate is no longer available.');
      case 5100:
        return new BadRequestException(`Supplier schema validation error: ${message}`);
      case 1108:
        return new BadGatewayException('Supplier connectivity timeout. Please retry shortly.');
      default:
        return new InternalServerErrorException(`Supplier error [${code}]: ${message}`);
    }
  }

  private asRecord(value: unknown, label: string): UnknownRecord {
    const record = this.optionalRecord(value);
    if (!record) {
      throw new BadGatewayException(`Invalid Nemo XML: missing ${label}.`);
    }
    return record;
  }

  private optionalRecord(value: unknown): UnknownRecord | undefined {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as UnknownRecord)
      : undefined;
  }

  private firstRecord(value: unknown): UnknownRecord {
    const first = Array.isArray(value) ? value[0] : value;
    return this.asRecord(first, 'error details');
  }

  private toRecordArray(value: unknown): UnknownRecord[] {
    const values: unknown[] = Array.isArray(value) ? value : value === undefined ? [] : [value];
    return values.map((entry) => this.asRecord(entry, 'response item'));
  }

  private optionalString(value: unknown): string | undefined {
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return undefined;
  }

  private requiredString(value: unknown, label: string): string {
    const result = this.optionalString(value);
    if (result === undefined) {
      throw new BadGatewayException(`Invalid Nemo XML: missing ${label}.`);
    }
    return result;
  }

  private optionalNumber(value: unknown): number | undefined {
    const text = this.optionalString(value);
    if (text === undefined) {
      return undefined;
    }
    const numberValue = Number(text);
    return Number.isFinite(numberValue) ? numberValue : undefined;
  }

  private toNumber(value: unknown, fallback: number): number {
    return this.optionalNumber(value) ?? fallback;
  }
}
