import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  @ApiPropertyOptional({ type: Number, description: 'Page number, starting at 1', example: 1, default: 1 })
  public readonly page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @ApiPropertyOptional({ type: Number, description: 'Maximum items per page (1–100)', example: 20, default: 20 })
  public readonly limit?: number = 20;

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  @ApiPropertyOptional({ type: String, enum: ['ASC', 'DESC'], description: 'Sort direction', example: 'ASC', default: 'ASC' })
  public readonly sortOrder?: 'ASC' | 'DESC' = 'ASC';
}

export class QueryAmenitiesDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ type: String, description: 'Text to search in the catalog', example: 'Hotel' })
  public readonly search?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ type: String, description: 'Single amenity group code', example: 'HTL' })
  public readonly groupCode?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ type: String, description: 'Comma-separated amenity group codes', example: 'HTL,ROOM' })
  public readonly groupCodes?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ type: String, description: 'Comma-separated catalog codes', example: '1,2' })
  public readonly codes?: string;
}

export class QuerySuppliersDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ type: String, description: 'Text to search in the catalog', example: 'Hotel' })
  public readonly search?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ type: String, description: 'Comma-separated catalog codes', example: '1,2' })
  public readonly codes?: string;
}

export class QueryAccommodationsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ type: String, description: 'Text to search in the catalog', example: 'Hotel' })
  public readonly search?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ type: String, description: 'Comma-separated catalog codes', example: '1,2' })
  public readonly codes?: string;
}
