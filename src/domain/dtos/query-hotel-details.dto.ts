import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { ProviderType } from '../enums/provider.enum';

export class QueryHotelProviderDto {
  @IsOptional()
  @IsString()
  @Matches(/\S/)
  @MaxLength(100)
  @ApiPropertyOptional({ type: String, description: 'Tenant that owns the hotel data', example: 'tnt_example' })
  public tenantId?: string;

  @IsOptional()
  @IsEnum(ProviderType)
  @ApiPropertyOptional({ type: String, enum: ProviderType, description: 'Hotel provider; mock works offline', example: 'mock', default: 'mock' })
  public provider?: ProviderType = ProviderType.MOCK;
}

export class QueryHotelDetailsDto extends QueryHotelProviderDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-z]{2}(?:-[A-Z]{2})?$/)
  @ApiPropertyOptional({ type: String, description: 'Language code for hotel content', example: 'es', default: 'es' })
  public language?: string = 'es';

  // Identificador de Nemo distinto del hotelCode de la URL, devuelto por /hotels/search para este
  // hotel. Sin él, Nemo no puede resolver el detalle (ver nemo-xml.builder.ts).
  @IsOptional()
  @IsString()
  @Matches(/\S/)
  @MaxLength(100)
  @ApiPropertyOptional({ type: String, description: 'Nemo HotelDetailId returned by /hotels/search for this hotel (required for provider=nemo to resolve details)', example: 'B7H-29NOV-4ND' })
  public hotelDetailId?: string;
}
