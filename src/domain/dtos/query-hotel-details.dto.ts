import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { ProviderType } from '../enums/provider.enum';

export class QueryHotelProviderDto {
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
}
