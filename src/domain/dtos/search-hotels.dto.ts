import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BoardType } from '../enums/board-type.enum';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PassengerAgeType } from '../enums/passenger-age-type.enum';
import { RoomType } from '../enums/room-type.enum';

export class PassengerDto {
  @IsEnum(PassengerAgeType)
  @ApiProperty({ type: String, enum: PassengerAgeType, description: 'Passenger age category', example: 'ADT' })
  public ageType!: PassengerAgeType;

  @ValidateIf((passenger: PassengerDto) => passenger.ageType !== PassengerAgeType.ADT)
  @IsInt()
  @Min(0)
  @Max(17)
  @ApiPropertyOptional({ type: Number, description: 'Age in years; required for children and infants', example: 8 })
  public age?: number;

  @IsInt()
  @Min(1)
  @ApiProperty({ type: Number, description: 'Room sequence referenced by passengers', example: 1 })
  public roomSequence!: number;
}

export class SearchRoomDto {
  @IsInt()
  @Min(1)
  @ApiProperty({ type: Number, description: 'Room sequence referenced by passengers', example: 1 })
  public roomSequence!: number;

  @IsEnum(RoomType)
  @ApiProperty({ type: String, enum: RoomType, description: 'Standard room type code', example: 'NMO.HTL.RMT.DBL' })
  public roomType!: RoomType;
}

export class SearchHotelsDto {
  @IsOptional()
  @IsString()
  @Matches(/\S/)
  @MaxLength(100)
  @ApiPropertyOptional({ type: String, description: 'Tenant that owns the hotel data', example: 'tnt_example' })
  public tenantId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @ApiProperty({ type: String, description: 'Provider destination identifier', example: '2262' })
  public destinationId!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'checkIn must use YYYY-MM-DD format' })
  @ApiProperty({ type: String, description: 'Check-in date (YYYY-MM-DD)', example: '2026-11-10', format: 'date' })
  public checkIn!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'checkOut must use YYYY-MM-DD format' })
  @ApiProperty({ type: String, description: 'Check-out date (YYYY-MM-DD)', example: '2026-11-15', format: 'date' })
  public checkOut!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => SearchRoomDto)
  @ApiProperty({ type: () => SearchRoomDto, isArray: true, description: 'Requested rooms' })
  public rooms!: SearchRoomDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(32)
  @ValidateNested({ each: true })
  @Type(() => PassengerDto)
  @ApiProperty({ type: () => PassengerDto, isArray: true, description: 'Passengers assigned to rooms' })
  public passengers!: PassengerDto[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @ApiPropertyOptional({ type: String, description: 'Filter by hotel name', example: 'Grand' })
  public hotelName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  @ApiPropertyOptional({ type: Number, description: 'Minimum star rating (1–5)', example: 3 })
  public minRating?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  @ApiPropertyOptional({ type: Number, description: 'Maximum star rating (1–5)', example: 5 })
  public maxRating?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(5, { each: true })
  @ApiPropertyOptional({ type: Number, isArray: true, description: 'Accepted star ratings', example: [4, 5] })
  public ratings?: number[];

  @IsOptional()
  @IsArray()
  @IsEnum(BoardType, { each: true })
  @ApiPropertyOptional({ type: String, enum: BoardType, isArray: true, description: 'Accepted board types', example: ['2'] })
  public boardTypes?: BoardType[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiPropertyOptional({ type: String, isArray: true, description: 'Restrict search to hotel codes', example: ['MOCK-2262-001'] })
  public hotelCodeList?: string[];
}
