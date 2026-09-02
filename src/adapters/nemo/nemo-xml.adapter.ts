import {
  BadGatewayException,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import axios from 'axios';
import { SearchHotelsDto } from '../../domain/dtos/search-hotels.dto';
import { HotelSearchResult } from '../../domain/models/hotel.model';
import { NemoXmlBuilder } from './nemo-xml.builder';
import { NemoXmlParser } from './nemo-xml.parser';

@Injectable()
export class NemoXmlAdapter {
  private readonly defaultBaseUrl = 'https://service-cert.psurfer.net/pricesurfer';

  public constructor(
    private readonly builder: NemoXmlBuilder,
    private readonly parser: NemoXmlParser,
  ) {}

  public async searchHotels(dto: SearchHotelsDto): Promise<HotelSearchResult> {
    const transactionId = this.createTransactionId();
    const xml = this.builder.buildAvailabilityRequest(dto, transactionId);
    const baseUrl = (process.env.NEMO_BASE_URL ?? this.defaultBaseUrl).replace(/\/+$/, '');
    const authToken = process.env.NEMO_AUTH_TOKEN ?? '';

    try {
      const response = await axios.post<string>(`${baseUrl}/catalog/products/search`, xml, {
        headers: {
          'Content-Type': 'application/xml',
          Accept: 'application/xml',
          'X-PS-AUTHTOKEN': authToken,
          'Accept-Encoding': 'gzip',
        },
        responseType: 'text',
        timeout: 15_000,
        transformResponse: [(body: string): string => body],
      });
      return this.parser.parseAvailabilityResponse(response.data, transactionId);
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          throw new UnauthorizedException('Authentication with hotel supplier failed.');
        }
        const status = error.response?.status;
        const suffix = status ? ` (HTTP ${status})` : '';
        throw new BadGatewayException(`Unable to complete the Nemo hotel search${suffix}.`);
      }
      throw new BadGatewayException('Nemo returned an invalid hotel search response.');
    }
  }

  private createTransactionId(): string {
    const timestamp = Date.now();
    const random = Math.floor(100_000 + Math.random() * 900_000);
    return `TX_SEARCH_${timestamp}_${random}`;
  }
}
