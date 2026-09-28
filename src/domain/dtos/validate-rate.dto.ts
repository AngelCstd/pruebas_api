import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class ValidateRateDto {
  @IsString()
  @Matches(/\S/, { message: 'tripProductId must not be blank' })
  @ApiProperty({ type: String, description: 'Rate identifier returned by hotel search', example: 'MOCK-2262-001' })
  public readonly tripProductId!: string;
}
