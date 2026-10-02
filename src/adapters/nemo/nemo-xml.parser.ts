import { BookingDetailResult, BookingCancellationResult } from '../../domain/models/booking-lifecycle.model';
import { HotelDetailsResult } from '../../domain/models/hotel-details.model';
import { HotelCatalogResult } from '../../domain/models/hotel-catalog.model';
import { BookingResult } from '../../domain/models/booking.model';
import { RateValidationResult, CancellationFeesResult } from '../../domain/models/rate-lifecycle.model';
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
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { HotelItem, HotelRate, HotelRoomRate, HotelSearchResult } from '../../domain/models/hotel.model';
import { ProviderType } from '../../domain/enums/provider.enum';

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
    const response = this.parseResponse(xml, 'AvailabilityQueryRS');
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

  public parseValidationResponse(xml: string, fallbackTransactionId: string): RateValidationResult {
    const response = this.parseResponse(xml, 'AvailabilityValidationRS');
    const price = this.asRecord(response.ValidatedPrice, 'ValidatedPrice');
    const changed = this.requiredString(price['@_PriceChanged'], 'PriceChanged');
    if (!['true', 'false', '1', '0'].includes(changed)) {
      throw new BadGatewayException('Invalid Nemo PriceChanged flag.');
    }
    return {
      transactionId: this.optionalString(response['@_TransactionId']) ?? fallbackTransactionId,
      provider: ProviderType.NEMO,
      tripProductId: this.requiredString(response.TripProductID, 'TripProductID'),
      validatedPrice: {
        amount: this.requiredAmount(price['@_Amount'], 'Amount'),
        currency: this.requiredString(price['@_Currency'], 'Currency'),
        priceChanged: changed === 'true' || changed === '1',
      },
      availabilityStatus: this.requiredString(response.AvailabilityStatus, 'AvailabilityStatus'),
      rateStatus: this.requiredString(response.RateStatus, 'RateStatus'),
    };
  }

  public parseCancellationFeesResponse(xml: string, fallbackTransactionId: string): CancellationFeesResult {
    const response = this.parseResponse(xml, 'CancellationFeesQueryRS');
    if (response.FeeSchedule === undefined) {
      throw new BadGatewayException('Invalid Nemo XML: missing FeeSchedule.');
    }
    const schedule = response.FeeSchedule === '' ? {} : this.asRecord(response.FeeSchedule, 'FeeSchedule');
    const deadline = response.FreeCancellationDeadline === undefined ? undefined
      : this.requiredDate(response.FreeCancellationDeadline, 'FreeCancellationDeadline');
    return {
      transactionId: this.optionalString(response['@_TransactionId']) ?? fallbackTransactionId,
      provider: ProviderType.NEMO,
      tripProductId: this.requiredString(response.TripProductID, 'TripProductID'),
      currency: this.requiredString(response.Currency, 'Currency'),
      ...(deadline ? { freeCancellationDeadline: deadline } : {}),
      feeSchedule: this.toRecordArray(schedule.Tier).map((tier) => {
        const startDate = this.requiredDate(tier['@_StartDate'], 'StartDate');
        const endDate = tier['@_EndDate'] === undefined ? undefined : this.requiredDate(tier['@_EndDate'], 'EndDate');
        const penaltyPercentage = this.requiredAmount(tier['@_PenaltyPercentage'], 'PenaltyPercentage');
        if (penaltyPercentage > 100 || (endDate && Date.parse(endDate) < Date.parse(startDate))) {
          throw new BadGatewayException('Invalid Nemo cancellation fee tier.');
        }
        return { startDate, ...(endDate ? { endDate } : {}),
          feeAmount: this.requiredAmount(tier['@_FeeAmount'], 'FeeAmount'), penaltyPercentage };
      }),
    };
  }

  private requiredDate(value: unknown, label: string): string {
    const text = this.requiredString(value, label);
    if (!Number.isFinite(Date.parse(text))) throw new BadGatewayException(`Invalid Nemo ${label}.`);
    return text;
  }

  private requiredAmount(value: unknown, label: string): number {
    const text = this.requiredString(value, label);
    const amount = Number(text);
    if (!Number.isFinite(amount) || amount < 0) throw new BadGatewayException(`Invalid Nemo ${label}.`);
    return amount;
  }

  private parseResponse(xml: string, root: string): UnknownRecord {
    if (XMLValidator.validate(xml) !== true) {
      throw new BadGatewayException('Invalid Nemo XML document.');
    }
    const parsed: unknown = this.xmlParser.parse(xml);
    const document = this.asRecord(parsed, 'Nemo response document');
    const errorRoot = this.optionalRecord(document.ErrorRS);
    if (errorRoot) {
      this.throwNemoError(errorRoot);
    }

    const response = this.asRecord(document[root], root);
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

    return response;
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
      bookable: false,
      bookableReason: 'PROVIDER_BOOKING_DISABLED',
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
      case 5010:
      case 5020:
        return new NotFoundException('Requested hotel rate was not found or is invalid.');
      case 1107:
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
    if (result === undefined || result.trim() === '') {
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
  public parseHotelDetailsResponse(xml: string): HotelDetailsResult {
    const response = this.parseResponse(xml, 'AdditionalInfoQueryRS');
    return {
      hotelCode: this.requiredString(response.HotelCode, 'HotelCode'),
      description: this.requiredString(response.Description, 'Description'),
      checkInTime: this.requiredTime(response.CheckInTime, 'CheckInTime'),
      checkOutTime: this.requiredTime(response.CheckOutTime, 'CheckOutTime'),
      amenities: this.collection(response.Amenities, 'Amenity').map((item) => ({
        code: this.requiredString(item['@_Code'], 'Amenity.Code'), name: this.requiredString(item['#text'], 'Amenity.Name'),
      })),
      images: this.collection(response.Images, 'Image').map((item) => {
        const url = this.requiredString(item['@_Url'], 'Image.Url');
        try { if (!['https:', 'http:'].includes(new URL(url).protocol)) throw new Error(); }
        catch { throw new BadGatewayException('Invalid Nemo image URL.'); }
        return { category: this.requiredString(item['@_Category'], 'Image.Category'), url };
      }),
    };
  }

  public parseHotelCatalogResponse(xml: string): HotelCatalogResult {
    const response = this.parseResponse(xml, 'HotelCatalogQueryRS');
    const hotels = this.collection(response.Hotels, 'HotelSummary').map((hotel) => ({
      hotelCode: this.requiredString(hotel['@_HotelCode'], 'HotelCode'),
      hotelName: this.requiredString(hotel['@_HotelName'], 'HotelName'),
      rating: this.boundedNumber(hotel['@_Rating'], 'Rating', 0, 5),
      latitude: this.boundedNumber(hotel['@_Latitude'], 'Latitude', -90, 90),
      longitude: this.boundedNumber(hotel['@_Longitude'], 'Longitude', -180, 180),
      city: this.requiredString(hotel['@_City'], 'City'), country: this.requiredString(hotel['@_Country'], 'Country'),
    }));
    const hotelCount = this.requiredAmount(response.HotelCount, 'HotelCount');
    if (!Number.isInteger(hotelCount) || hotelCount !== hotels.length) throw new BadGatewayException('Invalid Nemo HotelCount.');
    return { destinationCode: this.requiredString(response.DestinationCode, 'DestinationCode'),
      destinationName: this.requiredString(response.DestinationName, 'DestinationName'), hotelCount, hotels };
  }

  public parseBookingResponse(xml: string): BookingResult {
    const response = this.parseResponse(xml, 'BookingProductsRS');
    return { ...this.mapBookingDetail(response), creationDate: this.requiredDate(response.CreationDate, 'CreationDate') };
  }

  private mapBookingDetail(response: UnknownRecord): BookingDetailResult {
    const price = this.asRecord(response.TotalPrice, 'TotalPrice');
    const hotel = this.asRecord(response.HotelInformation, 'HotelInformation');
    const checkIn = this.requiredDate(hotel.CheckIn, 'CheckIn');
    const checkOut = this.requiredDate(hotel.CheckOut, 'CheckOut');
    if (Date.parse(checkOut) <= Date.parse(checkIn)) throw new BadGatewayException('Invalid Nemo booking dates.');
    return {
      bookingLocator: this.requiredString(response.BookingLocator, 'BookingLocator'),
      supplierConfirmationCode: this.requiredString(response.SupplierConfirmationCode, 'SupplierConfirmationCode'),
      clientReference: this.requiredString(response.ClientReference, 'ClientReference'),
      bookingStatus: this.requiredString(response.BookingStatus, 'BookingStatus'),
      totalPrice: { amount: this.requiredAmount(price['@_Amount'], 'Amount'), currency: this.requiredString(price['@_Currency'], 'Currency') },
      hotelInformation: { hotelCode: this.requiredString(hotel.HotelCode, 'HotelCode'),
        hotelName: this.requiredString(hotel.HotelName, 'HotelName'), checkIn, checkOut },
    };
  }

  public parseBookingDetailResponse(xml: string): BookingDetailResult {
    const response = this.parseResponse(xml, 'BookingQueryRS');
    const detail = this.mapBookingDetail(response);
    if (response.CancellationDeadline !== undefined) {
      detail.cancellationDeadline = this.requiredDate(response.CancellationDeadline, 'CancellationDeadline');
    }
    if (response.VoucherUrl !== undefined) {
      const url = this.requiredString(response.VoucherUrl, 'VoucherUrl');
      try { if (!['https:', 'http:'].includes(new URL(url).protocol)) throw new Error(); }
      catch { throw new BadGatewayException('Invalid Nemo voucher URL.'); }
      detail.voucherUrl = url;
    }
    return detail;
  }

  public parseBookingCancellationResponse(xml: string): BookingCancellationResult {
    const response = this.parseResponse(xml, 'BookingCancellationRS');
    return {
      bookingLocator: this.requiredString(response.BookingLocator, 'BookingLocator'),
      cancellationStatus: this.requiredString(response.CancellationStatus, 'CancellationStatus'),
      cancellationReference: this.requiredString(response.CancellationReference, 'CancellationReference'),
      penaltyFee: this.parseMoney(response.PenaltyFee, 'PenaltyFee'),
      refundAmount: this.parseMoney(response.RefundAmount, 'RefundAmount'),
    };
  }

  private parseMoney(value: unknown, label: string): { amount: number; currency: string } {
    const money = this.asRecord(value, label);
    return { amount: this.requiredAmount(money['@_Amount'], label + '.Amount'),
      currency: this.requiredString(money['@_Currency'], label + '.Currency') };
  }

  private collection(value: unknown, item: string): UnknownRecord[] {
    if (value === undefined || value === '') return [];
    return this.toRecordArray(this.asRecord(value, item + ' container')[item]);
  }

  private requiredTime(value: unknown, label: string): string {
    const time = this.requiredString(value, label);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new BadGatewayException(`Invalid Nemo ${label}.`);
    return time;
  }

  private boundedNumber(value: unknown, label: string, min: number, max: number): number {
    const number = Number(this.requiredString(value, label));
    if (!Number.isFinite(number) || number < min || number > max) throw new BadGatewayException(`Invalid Nemo ${label}.`);
    return number;
  }

}
