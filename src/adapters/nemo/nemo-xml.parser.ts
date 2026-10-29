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
    const details = this.optionalRecord(response.Details);
    let rawHotels: unknown[] = [];

    if (details) {
      const trips = this.optionalRecord(details.Trips);
      const trip = trips ? (Array.isArray(trips.Trip) ? trips.Trip[0] : trips.Trip) : undefined;
      const tripRec = this.optionalRecord(trip);
      const hotelsAvail = tripRec ? this.optionalRecord(tripRec.HotelsAvailability) : undefined;
      const hotelsContainer = hotelsAvail ? this.optionalRecord(hotelsAvail.Hotels) : undefined;
      if (hotelsContainer) {
        rawHotels = Array.isArray(hotelsContainer.Hotel)
          ? hotelsContainer.Hotel
          : hotelsContainer.Hotel ? [hotelsContainer.Hotel] : [];
      }
    } else if (response.Hotels) {
      const hotelsContainer = this.optionalRecord(response.Hotels);
      if (hotelsContainer) {
        rawHotels = Array.isArray(hotelsContainer.Hotel)
          ? hotelsContainer.Hotel
          : hotelsContainer.Hotel ? [hotelsContainer.Hotel] : [];
      }
    }

    const hotels = rawHotels.map((hotel) => this.mapHotel(hotel as UnknownRecord));
    const pagination = this.optionalRecord(response.Pagination);
    const totalItems = pagination
      ? this.toNumber(pagination.TotalItems, hotels.length)
      : hotels.length;

    return {
      transactionId: this.optionalString(response['@_TransactionId']) ?? fallbackTransactionId,
      provider: ProviderType.NEMO,
      totalItems,
      hotels,
      ...(hotels.length < 3 ? { rawResponse: xml } : {}),
    };
  }

  // El esquema real no trae ValidatedPrice/AvailabilityStatus/RateStatus como campos propios
  // (confirmado contra el proyecto SoapUI real); vuelve a entregar la tarifa completa anidada en
  // Details>Products>Hotels>Rate. Nemo no informa si el precio cambió respecto al de la búsqueda
  // -- no hay con qué comparar en esta respuesta -- así que `priceChanged` queda en `false` como
  // mejor esfuerzo documentado, y `rateStatus` reutiliza el código de disponibilidad de la
  // habitación (es la única señal de estado que Nemo da aquí).
  public parseValidationResponse(xml: string, fallbackTransactionId: string): RateValidationResult {
    const response = this.parseResponse(xml, 'AvailabilityValidationRS');
    const hotelsContainer = this.optionalRecord(this.optionalRecord(this.optionalRecord(response.Details)?.Products)?.Hotels);
    const rawRate = hotelsContainer ? (Array.isArray(hotelsContainer.Rate) ? hotelsContainer.Rate[0] : hotelsContainer.Rate) : undefined;
    const rate = this.asRecord(rawRate, 'Rate');
    const { amount, currency } = this.ratePrice(rate.RatePrices, 'RatePrices');
    const rooms = this.collection(rate.Rooms, 'Room');
    const availabilityStatus = this.optionalString(rooms[0]?.['@_Availability']) ?? 'UNKNOWN';

    return {
      transactionId: this.optionalString(response['@_TransactionId']) ?? fallbackTransactionId,
      provider: ProviderType.NEMO,
      tripProductId: this.requiredString(rate['@_TripProductID'], 'TripProductID'),
      validatedPrice: { amount, currency, priceChanged: false },
      availabilityStatus,
      rateStatus: availabilityStatus,
    };
  }

  // El esquema real agrupa las condiciones de cancelación en Details>Products>Hotels>Hotel>Rate>
  // ChargeConditions (confirmado contra el proyecto SoapUI real), no en un FeeSchedule plano.
  // Cada ChargeCondition da un rango en días relativos al check-in (no fechas de calendario) y un
  // monto fijo (no un porcentaje) -- se convierten usando el CheckIn real del hotel y el precio
  // total de la tarifa como base del porcentaje.
  public parseCancellationFeesResponse(xml: string, fallbackTransactionId: string): CancellationFeesResult {
    const response = this.parseResponse(xml, 'CancellationFeesQueryRS');
    const hotelsContainer = this.optionalRecord(this.optionalRecord(this.optionalRecord(response.Details)?.Products)?.Hotels);
    const rawHotel = hotelsContainer ? (Array.isArray(hotelsContainer.Hotel) ? hotelsContainer.Hotel[0] : hotelsContainer.Hotel) : undefined;
    const hotel = this.asRecord(rawHotel, 'Hotel');
    const rate = this.asRecord(hotel.Rate, 'Rate');
    const checkIn = this.requiredDate(hotel.CheckIn, 'CheckIn');
    const { amount: totalAmount, currency } = this.ratePrice(rate.RatePrices, 'RatePrices');
    const deadlineDate = this.optionalRecord(rate.Deadline)?.Date;
    const deadline = deadlineDate === undefined ? undefined : this.requiredDate(deadlineDate, 'Deadline.Date');

    return {
      transactionId: this.optionalString(response['@_TransactionId']) ?? fallbackTransactionId,
      provider: ProviderType.NEMO,
      tripProductId: this.requiredString(rate['@_TripProductID'], 'TripProductID'),
      currency,
      ...(deadline ? { freeCancellationDeadline: deadline } : {}),
      feeSchedule: this.collection(rate.ChargeConditions, 'ChargeCondition').map((condition) => {
        const range = this.asRecord(condition.DateRangeWithDays, 'DateRangeWithDays');
        const daysFrom = this.toNumber(range.DateFrom, 0);
        const daysTo = this.toNumber(range.DateTo, 0);
        const { amount: feeAmount } = this.ratePrice(condition.RatePrices, 'RatePrices');
        const startDate = this.subtractDays(checkIn, daysTo);
        const endDate = this.subtractDays(checkIn, daysFrom);
        const penaltyPercentage = totalAmount > 0 ? Math.min(100, Math.round((feeAmount / totalAmount) * 10000) / 100) : 0;
        return { startDate, endDate, feeAmount, penaltyPercentage };
      }),
    };
  }

  private ratePrice(value: unknown, label: string): { amount: number; currency: string } {
    const container = this.optionalRecord(value);
    const prices = container ? this.toRecordArray(container.RatePrice) : [];
    const chosen = prices.find((p) => ['NMO.GBL.RPT.GRS', 'NMO.GBL.RPT.NET', 'GRS', 'NET'].includes(this.optionalString(p['@_Type']) ?? '')) ?? prices[0];
    if (!chosen) throw new BadGatewayException(`Invalid Nemo XML: missing ${label}.`);
    return {
      amount: this.requiredAmount(chosen['#text'] ?? chosen['@_Amount'], label + '.Amount'),
      currency: this.requiredString(chosen['@_Currency'], label + '.Currency'),
    };
  }

  private subtractDays(isoDate: string, days: number): string {
    const date = new Date(`${isoDate.slice(0, 10)}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() - days);
    return date.toISOString().slice(0, 10);
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
      if (root === 'AvailabilityQueryRS' && (code === 5000 || message.toLowerCase().includes('no availability'))) {
        return response;
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
    const latitude = this.optionalNumber(hotel['@_Latitude'] ?? position.Latitude);
    const longitude = this.optionalNumber(hotel['@_Longitude'] ?? position.Longitude);
    const ratingRecord = this.optionalRecord(hotel.Rating);
    const ratingVal = ratingRecord ? ratingRecord.Value : hotel['@_Rating'] ?? hotel.HotelRating;
    const hotelDetailId = this.optionalString(hotel['@_HotelDetailId']);

    return {
      hotelCode: this.requiredString(hotel['@_Code'] ?? hotel['@_HotelCode'] ?? hotel.HotelCode, 'HotelCode'),
      hotelName: this.requiredString(hotel['@_Name'] ?? hotel['@_HotelName'] ?? hotel.HotelName, 'HotelName'),
      rating: this.toNumber(ratingVal, 0),
      ...(hotelDetailId ? { hotelDetailId } : {}),
      address: {
        street: this.optionalString(address.Line ?? address.Street) ?? '',
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
    const priceRecord = this.optionalRecord(rate.Price);
    let amount = 0;
    let currency = 'EUR';
    if (priceRecord) {
      amount = this.toNumber(priceRecord['@_Amount'], 0);
      currency = this.optionalString(priceRecord['@_Currency']) ?? 'EUR';
    } else if (rate.RatePrices) {
      const rpContainer = this.optionalRecord(rate.RatePrices);
      if (rpContainer) {
        const rpList = this.toRecordArray(rpContainer.RatePrice);
        const grsOrNet = rpList.find((p) => (this.optionalString(p['@_Type']) === 'GRS' || this.optionalString(p['@_Type']) === 'NET')) ?? rpList[0];
        if (grsOrNet) {
          amount = this.toNumber(grsOrNet['#text'] ?? grsOrNet['@_Amount'], 0);
          currency = this.optionalString(grsOrNet['@_Currency']) ?? 'MXN';
        }
      }
    }
    const boardRecord = this.optionalRecord(rate.Board);
    const rateBoardCode = this.optionalString(boardRecord ? boardRecord['@_Code'] : undefined);
    const rateBoardDesc = this.optionalString(boardRecord ? boardRecord['#text'] ?? boardRecord : rate.Board);

    const roomRatesContainer = this.optionalRecord(rate.RoomRates) ?? this.optionalRecord(rate.Rooms);
    const roomRates = roomRatesContainer
      ? this.toRecordArray(roomRatesContainer.RoomRate ?? roomRatesContainer.Room).map((roomRate) =>
          this.mapRoomRate(roomRate, rateBoardCode, rateBoardDesc),
        )
      : [];
    const policy = this.optionalRecord(rate.CancellationPolicy);

    return {
      tripProductId: this.requiredString(rate['@_TripProductID'] ?? rate.TripProductID, 'TripProductID'),
      rateClass: this.optionalString(rate['@_RateClass'] ?? rate.RateClass) ?? 'Standard',
      amount,
      currency,
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

  private mapRoomRate(roomRate: UnknownRecord, fallbackBoardCode?: string, fallbackBoardDesc?: string): HotelRoomRate {
    const boardType = this.optionalRecord(roomRate.BoardType) ?? {};
    const rawType = this.optionalString(roomRate['@_Type'] ?? roomRate.RoomType) ?? '';
    const description = this.optionalString(roomRate.RoomDescription ?? roomRate.Description);
    const roomText = this.optionalString(roomRate['#text']);
    const friendlyName = (description && description.trim().toLowerCase() !== 'test')
      ? description.trim()
      : (roomText && roomText.trim().toLowerCase() !== 'test')
        ? roomText.trim()
        : this.mapNemoRoomType(rawType);

    const boardCode = this.optionalString(boardType['@_Code']) ?? fallbackBoardCode ?? 'RO';
    const boardDescription = this.optionalString(boardType['@_Description']) ?? fallbackBoardDesc ?? 'Sólo alojamiento';

    return {
      roomSequence: this.toNumber(roomRate['@_RoomSequence'], 1),
      roomType: friendlyName,
      boardCode,
      boardDescription,
    };
  }

  private mapNemoRoomType(code: string): string {
    const cleanCode = code.toUpperCase().trim();
    const map: Record<string, string> = {
      'NMO.HTL.RMT.BED.2BD': 'Habitación Doble (2 Camas)',
      'NMO.HTL.RMT.BED.1BD': 'Habitación con 1 Cama King/Queen',
      'NMO.HTL.RMT.BED.TWN': 'Habitación Twin (2 Camas)',
      'NMO.HTL.RMT.DBL': 'Habitación Doble',
      'NMO.HTL.RMT.SGL': 'Habitación Individual',
      'NMO.HTL.RMT.TPL': 'Habitación Triple',
      'NMO.HTL.RMT.QUA': 'Habitación Cuádruple',
      'NMO.HTL.RMT.STE': 'Suite',
      'NMO.HTL.RMT.JSU': 'Junior Suite',
      'NMO.HTL.RMT.FAM': 'Habitación Familiar',
      'NMO.HTL.RMT.STD': 'Habitación Estándar',
      'NMO.HTL.RMT.SUP': 'Habitación Superior',
      'NMO.HTL.RMT.DLX': 'Habitación Deluxe',
      'NMO.HTL.RMT.EXC': 'Habitación Ejecutiva',
      'DBL': 'Habitación Doble',
      'SGL': 'Habitación Individual',
      'TPL': 'Habitación Triple',
      'QUA': 'Habitación Cuádruple',
    };
    if (map[cleanCode]) return map[cleanCode];
    if (cleanCode.endsWith('2BD')) return 'Habitación Doble (2 Camas)';
    if (cleanCode.endsWith('1BD')) return 'Habitación con 1 Cama';
    if (cleanCode.endsWith('DBL')) return 'Habitación Doble';
    if (cleanCode.endsWith('SGL')) return 'Habitación Individual';
    if (cleanCode.endsWith('TPL')) return 'Habitación Triple';
    if (cleanCode.endsWith('QUA')) return 'Habitación Cuádruple';
    if (cleanCode.endsWith('STE')) return 'Suite';
    if (cleanCode.startsWith('NMO.HTL.RMT.')) {
      const suffix = cleanCode.replace('NMO.HTL.RMT.', '').replace(/\./g, ' ');
      return `Habitación ${suffix}`;
    }
    return code || 'Habitación Estándar';
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
  // El detalle real de Nemo viene anidado en Details>Products>Hotels>Hotel (confirmado contra el
  // proyecto SoapUI real), no plano en la raíz como se asumía antes. Ese hotel de prueba de
  // certificación no tiene CheckInTime/CheckOutTime/Images cargados en el sistema de Nemo (los
  // tags no aparecen en absoluto en la respuesta) -- se usan valores por defecto razonables para
  // check-in/check-out porque el esquema de este endpoint no los expone; no hay dato real de
  // imágenes para confirmar el nombre del tag cuando un hotel sí las tiene cargadas.
  public parseHotelDetailsResponse(xml: string, hotelCodeFallback?: string): HotelDetailsResult {
    const response = this.parseResponse(xml, 'AdditionalInfoQueryRS');
    const hotelsContainer = this.optionalRecord(this.optionalRecord(this.optionalRecord(response.Details)?.Products)?.Hotels);
    const rawHotel = hotelsContainer ? (Array.isArray(hotelsContainer.Hotel) ? hotelsContainer.Hotel[0] : hotelsContainer.Hotel) : undefined;
    const hotel = this.optionalRecord(rawHotel) ?? {};
    if (!hotel['@_HotelCode']) {
      return {
        hotelCode: hotelCodeFallback ?? '',
        description: 'Información general provista por Nemo.',
        checkInTime: '15:00',
        checkOutTime: '12:00',
        amenities: [],
        images: [],
      };
    }

    const descriptions = this.collection(hotel.HotelDescriptions, 'HotelDescription')
      .map((item) => this.optionalString(item['#text']))
      .filter((text): text is string => !!text && text.trim() !== '');
    const addressLine = this.optionalString(
      this.optionalRecord(this.optionalRecord(this.toRecordArray(this.optionalRecord(hotel.Addresses)?.Address)[0])?.AddressLines)?.AddressLine,
    );

    return {
      hotelCode: this.requiredString(hotel['@_HotelCode'], 'HotelCode'),
      description: descriptions.join(' ') || addressLine || 'Información general provista por Nemo.',
      checkInTime: '15:00',
      checkOutTime: '12:00',
      amenities: this.collection(hotel.Amenities, 'Amenity').map((item) => ({
        code: this.requiredString(item['@_Code'], 'Amenity.Code'), name: this.requiredString(item['#text'], 'Amenity.Name'),
      })),
      images: this.collection(hotel.Images, 'Image').map((item) => {
        const url = this.requiredString(item['@_Url'], 'Image.Url');
        try { if (!['https:', 'http:'].includes(new URL(url).protocol)) throw new Error(); }
        catch { throw new BadGatewayException('Invalid Nemo image URL.'); }
        return { category: this.requiredString(item['@_Category'], 'Image.Category'), url };
      }),
    };
  }

  public parseHotelCatalogResponse(xml: string): HotelCatalogResult {
    const response = this.parseResponse(xml, 'HotelCatalogQueryRS');
    const details = this.optionalRecord(response.Details);
    if (details) {
      const hotels = this.collection(details.Hotels, 'Hotel').map((hotel) => ({
        hotelCode: this.requiredString(hotel['@_HotelDetailId'], 'HotelDetailId'),
        supplierId: this.requiredString(hotel['@_SupplierId'], 'SupplierId'),
        supplierHotelCode: this.requiredString(hotel['@_SupplierHotelCode'], 'SupplierHotelCode'),
        mphHotelId: this.requiredString(hotel['@_MphHotelId'], 'MphHotelId'),
        destinationId: this.requiredString(hotel['@_DestinationId'], 'DestinationId'),
        hotelDetailId: this.requiredString(hotel['@_HotelDetailId'], 'HotelDetailId'),
      }));
      const nextPageToken = this.optionalString(details.NextPageToken);
      return {
        hotelCount: hotels.length,
        ...(nextPageToken ? { nextPageToken } : {}),
        hotels,
      };
    }
    const hotels = this.collection(response.Hotels, 'HotelSummary').map((hotel) => ({
      hotelCode: this.requiredString(hotel['@_HotelCode'], 'HotelCode'),
      hotelName: this.requiredString(hotel['@_HotelName'], 'HotelName'),
      rating: this.boundedNumber(hotel['@_Rating'], 'Rating', 0, 5),
      latitude: this.boundedNumber(hotel['@_Latitude'], 'Latitude', -90, 90),
      longitude: this.boundedNumber(hotel['@_Longitude'], 'Longitude', -180, 180),
      city: this.requiredString(hotel['@_City'], 'City'),
      country: this.requiredString(hotel['@_Country'], 'Country'),
    }));
    const hotelCount = this.requiredAmount(response.HotelCount, 'HotelCount');
    if (!Number.isInteger(hotelCount) || hotelCount !== hotels.length) throw new BadGatewayException('Invalid Nemo HotelCount.');
    return {
      destinationCode: this.requiredString(response.DestinationCode, 'DestinationCode'),
      destinationName: this.requiredString(response.DestinationName, 'DestinationName'),
      hotelCount,
      hotels,
    };
  }

  private boundedNumber(value: unknown, label: string, min: number, max: number): number {
    const number = Number(this.requiredString(value, label));
    if (!Number.isFinite(number) || number < min || number > max) throw new BadGatewayException(`Invalid Nemo ${label}.`);
    return number;
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

}
