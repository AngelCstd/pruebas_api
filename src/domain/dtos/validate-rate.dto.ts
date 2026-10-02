import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class ValidateRateDto {
  @IsOptional()
  @IsString()
  @Matches(/\S/)
  @MaxLength(100)
  @ApiPropertyOptional({ type: String, description: 'Tenant that owns the hotel data', example: 'tnt_example' })
  public readonly tenantId?: string;

  @IsString()
  @Matches(/\S/, { message: 'tripProductId must not be blank' })
  @ApiProperty({ type: String, description: 'Rate identifier returned by hotel search', example: 'MOCK-2262-001' })
  public readonly tripProductId!: string;
}
