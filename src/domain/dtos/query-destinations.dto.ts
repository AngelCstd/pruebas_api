import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export const DESTINATION_LANGUAGES = ['es', 'en'] as const;
export type DestinationLanguage = (typeof DESTINATION_LANGUAGES)[number];

export class SearchDestinationsDto {
  @IsString()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @Length(3, 100)
  @ApiProperty({ type: String, description: 'Text to search in the destination label (min 3 characters)', example: 'cancun' })
  public readonly q!: string;

  @IsOptional()
  @IsIn(DESTINATION_LANGUAGES)
  @ApiPropertyOptional({ type: String, enum: DESTINATION_LANGUAGES, description: 'Catalog language', example: 'es', default: 'es' })
  public readonly language?: DestinationLanguage = 'es';

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Length(2, 10)
  @ApiPropertyOptional({ type: String, description: 'Filter by country code', example: 'MX' })
  public readonly countryId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @ApiPropertyOptional({ type: Number, description: 'Maximum results (1–50)', example: 10, default: 10 })
  public readonly limit?: number = 10;
}
