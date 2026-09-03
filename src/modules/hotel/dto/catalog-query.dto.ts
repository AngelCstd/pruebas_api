import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { ProviderType } from '../enums/provider.enum';

export class CatalogQueryDto {
  @IsOptional()
  @IsEnum(ProviderType)
  public provider: ProviderType = ProviderType.MOCK;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  public destinationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  public hotelName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  public city?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.toUpperCase() : value)
  @IsString()
  @Matches(/^[A-Z]{2}$/, { message: 'countryCode must use a two-letter ISO code' })
  public countryCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  public minRating?: number;
}

export class ProviderQueryDto {
  @IsOptional()
  @IsEnum(ProviderType)
  public provider: ProviderType = ProviderType.MOCK;
}
