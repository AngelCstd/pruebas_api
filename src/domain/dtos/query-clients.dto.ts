import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsString, Matches, MaxLength } from 'class-validator';

export class QueryClientsDto {
  @IsDefined({ message: 'tenantId is required' })
  @IsString()
  @Matches(/\S/)
  @MaxLength(100)
  @ApiProperty({ type: String, description: 'Tenant that owns the client data', example: 'tnt_example' })
  public tenantId!: string;
}
