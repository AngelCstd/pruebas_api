import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { QueryHotelProviderDto } from './query-hotel-details.dto';

export class QueryHotelCatalogDto extends QueryHotelProviderDto {
  @IsString()
  @Matches(/\S/)
  @MaxLength(64)
  @ApiProperty({ type: String, description: 'Provider destination code', example: '2262' })
  public destinationCode!: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  @ApiPropertyOptional({ type: Boolean, description: 'Only include active hotels', example: true, default: true })
  public activeOnly?: boolean = true;
}
