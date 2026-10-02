import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDefined, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class QueryPersonsDto {
  @IsDefined({ message: 'tenantId is required' })
  @IsString()
  @Matches(/\S/)
  @MaxLength(100)
  @ApiProperty({ type: String, description: 'Tenant that owns the person data', example: 'tnt_example' })
  public tenantId!: string;

  @IsDefined({ message: 'organizationId is required' })
  @IsString()
  @Matches(/\S/)
  @MaxLength(100)
  @ApiProperty({ type: String, description: 'Client organization whose people are listed', example: 'org_client' })
  public organizationId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @ApiPropertyOptional({ type: String, description: 'Case-insensitive name or email search' })
  public q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 50, default: 20 })
  public limit?: number;
}
