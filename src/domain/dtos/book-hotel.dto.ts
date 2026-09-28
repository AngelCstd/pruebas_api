import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsDefined, IsEmail, IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator';
import { PassengerAgeType } from '../enums/passenger-age-type.enum';

export class BookingPassengerDto {
  @IsIn(['MR', 'MRS', 'MS', 'MISS', 'MX', 'DR', 'CHD', 'INF'])
  @ApiProperty({ type: String, description: 'Passenger title', example: 'MR' })
  public title!: string;

  @IsString()
  @Matches(/\S/)
  @MaxLength(100)
  @ApiProperty({ type: String, description: 'Passenger given name', example: 'Carlos' })
  public firstName!: string;

  @IsString()
  @Matches(/\S/)
  @MaxLength(100)
  @ApiProperty({ type: String, description: 'Passenger family name', example: 'Mendez' })
  public lastName!: string;
}

export class LeadPassengerDto extends BookingPassengerDto {
  @IsEmail()
  @MaxLength(254)
  @ApiProperty({ type: String, description: 'Lead passenger email', example: 'carlos@example.com' })
  public email!: string;

  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/)
  @ApiProperty({ type: String, description: 'Phone number in international E.164 format', example: '+34611223344' })
  public phone!: string;
}

export class BookingGuestDto extends BookingPassengerDto {
  @IsEnum(PassengerAgeType)
  @ApiProperty({ type: String, enum: PassengerAgeType, description: 'Guest age category', example: 'ADT' })
  public type!: PassengerAgeType;

  @ValidateIf((guest: BookingGuestDto) => guest.type !== PassengerAgeType.ADT || guest.age !== undefined)
  @IsInt()
  @Min(0)
  @Max(17)
  @ApiPropertyOptional({ type: Number, description: 'Age in years; required for children and infants', example: 8 })
  public age?: number;
}

export class BookingRoomDto {
  @IsInt()
  @Min(1)
  @Max(8)
  @ApiProperty({ type: Number, description: 'Room sequence referenced by passengers', example: 1 })
  public roomSequence!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => BookingGuestDto)
  @ApiProperty({ type: () => BookingGuestDto, isArray: true, description: 'Guests staying in the room' })
  public guests!: BookingGuestDto[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @ApiPropertyOptional({ type: String, description: 'Optional requests for the booked room', example: 'Quiet room' })
  public specialRequests?: string;
}

export class BookHotelDto {
  @IsString()
  @Matches(/\S/)
  @MaxLength(256)
  @ApiProperty({ type: String, description: 'Rate identifier returned by hotel search', example: 'MOCK-2262-001' })
  public tripProductId!: string;

  @IsString()
  @Matches(/\S/)
  @MaxLength(100)
  @ApiProperty({ type: String, description: 'Client booking reference', example: 'CLIENT-1' })
  public clientReference!: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => LeadPassengerDto)
  @ApiProperty({ type: () => LeadPassengerDto, description: 'Primary booking contact' })
  public leadPassenger!: LeadPassengerDto;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ArrayUnique((room: BookingRoomDto) => room.roomSequence)
  @ValidateNested({ each: true })
  @Type(() => BookingRoomDto)
  @ApiProperty({ type: () => BookingRoomDto, isArray: true, description: 'Requested rooms' })
  public rooms!: BookingRoomDto[];
}
