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
  public ageType!: PassengerAgeType;

  @ValidateIf((passenger: PassengerDto) => passenger.ageType !== PassengerAgeType.ADT)
  @IsInt()
  @Min(0)
  @Max(17)
  public age?: number;

  @IsInt()
  @Min(1)
  public roomSequence!: number;
}

export class SearchRoomDto {
  @IsInt()
  @Min(1)
  public roomSequence!: number;

  @IsEnum(RoomType)
  public roomType!: RoomType;
}

export class SearchHotelsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  public destinationId!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'checkIn must use YYYY-MM-DD format' })
  public checkIn!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'checkOut must use YYYY-MM-DD format' })
  public checkOut!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => SearchRoomDto)
  public rooms!: SearchRoomDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(32)
  @ValidateNested({ each: true })
  @Type(() => PassengerDto)
  public passengers!: PassengerDto[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  public hotelName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  public minRating?: number;
}
