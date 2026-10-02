import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CancelBookingDto {
  @IsOptional()
  @IsString()
  @Matches(/\S/)
  @MaxLength(100)
  @ApiPropertyOptional({ type: String, description: 'Tenant that owns the booking data', example: 'tnt_example' })
  public tenantId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @ApiPropertyOptional({ type: String, description: 'Reason for cancellation', example: 'Travel plans changed' })
  public reason?: string;
}
