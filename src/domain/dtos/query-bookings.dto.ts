import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { ProviderType } from '../enums/provider.enum';

export enum BookingListStatus {
  BOOKED = 'BOOKED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
}

export class QueryBookingsDto {
  @IsOptional()
  @IsString()
  @Matches(/\S/)
  @MaxLength(100)
  @ApiPropertyOptional({ type: String, description: 'Tenant that owns the booking data', example: 'tnt_example' })
  public tenantId?: string;

  @IsOptional()
  @IsEnum(ProviderType)
  @ApiPropertyOptional({ enum: ProviderType, default: ProviderType.MOCK })
  public provider?: ProviderType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 100, default: 50 })
  public limit?: number;

  @IsOptional()
  @IsEnum(BookingListStatus)
  @ApiPropertyOptional({ enum: BookingListStatus })
  public status?: BookingListStatus;
}
