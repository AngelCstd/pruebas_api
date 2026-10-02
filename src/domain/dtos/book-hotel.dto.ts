import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsDefined, IsEmail, IsEnum, IsIn,
  IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, Validate, ValidateIf,
  ValidateNested, ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface,
} from 'class-validator';
import { PassengerAgeType } from '../enums/passenger-age-type.enum';

interface PassengerReferenceShape {
  readonly personId?: unknown;
  readonly title?: unknown;
  readonly firstName?: unknown;
  readonly lastName?: unknown;
  readonly email?: unknown;
  readonly phone?: unknown;
}

@ValidatorConstraint({ name: 'passengerReference', async: false })
class PassengerReferenceConstraint implements ValidatorConstraintInterface {
  public validate(_value: unknown, args: ValidationArguments): boolean {
    const passenger = args.object as PassengerReferenceShape;
    if (passenger.personId === undefined) return true;
    return typeof passenger.personId === 'string'
      && /\S/.test(passenger.personId)
      && passenger.personId.length <= 100
      && passenger.title === undefined
      && passenger.firstName === undefined
      && passenger.lastName === undefined
      && passenger.email === undefined
      && passenger.phone === undefined;
  }

  public defaultMessage(): string {
    return 'personId must be non-empty and cannot be combined with name fields';
  }
}

export class BookingPassengerDto {
  @Validate(PassengerReferenceConstraint)
  @ApiPropertyOptional({ type: String, description: 'Existing Care person identifier', example: 'per_example' })
  public personId?: string;

  @ValidateIf((passenger: BookingPassengerDto) => passenger.personId === undefined)
  @IsIn(['MR', 'MRS', 'MS', 'MISS', 'MX', 'DR', 'CHD', 'INF'])
  @ApiPropertyOptional({ type: String, description: 'Passenger title for a new person', example: 'MR' })
  public title?: string;

  @ValidateIf((passenger: BookingPassengerDto) => passenger.personId === undefined)
  @IsString()
  @Matches(/\S/)
  @MaxLength(100)
  @ApiPropertyOptional({ type: String, description: 'Passenger given name for a new person', example: 'Carlos' })
  public firstName?: string;

  @ValidateIf((passenger: BookingPassengerDto) => passenger.personId === undefined)
  @IsString()
  @Matches(/\S/)
  @MaxLength(100)
  @ApiPropertyOptional({ type: String, description: 'Passenger family name for a new person', example: 'Mendez' })
  public lastName?: string;
}

export class LeadPassengerDto extends BookingPassengerDto {
  @ValidateIf((passenger: LeadPassengerDto) => passenger.personId === undefined)
  @IsEmail()
  @MaxLength(254)
  @ApiPropertyOptional({ type: String, description: 'Email for a new lead passenger', example: 'carlos@example.com' })
  public email?: string;

  @ValidateIf((passenger: LeadPassengerDto) => passenger.personId === undefined)
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/)
  @ApiPropertyOptional({ type: String, description: 'Phone for a new lead passenger in E.164 format', example: '+34611223344' })
  public phone?: string;
}

export class BookingGuestDto extends BookingPassengerDto {
  @ValidateIf((guest: BookingGuestDto) => guest.personId === undefined || guest.type !== undefined)
  @IsEnum(PassengerAgeType)
  @ApiPropertyOptional({ type: String, enum: PassengerAgeType, description: 'Guest age category; defaults to ADT for an existing person', example: 'ADT' })
  public type?: PassengerAgeType;

  @ValidateIf((guest: BookingGuestDto) => guest.personId !== undefined
    ? guest.age !== undefined
    : guest.type !== PassengerAgeType.ADT || guest.age !== undefined)
  @IsInt()
  @Min(0)
  @Max(17)
  @ApiPropertyOptional({ type: Number, description: 'Age in years; required for new children and infants', example: 8 })
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
  @IsOptional()
  @IsString()
  @Matches(/\S/)
  @MaxLength(100)
  @ApiPropertyOptional({ type: String, description: 'Tenant that owns the booking data', example: 'tnt_example' })
  public tenantId?: string;

  @IsString()
  @Matches(/\S/)
  @MaxLength(100)
  @ApiProperty({ type: String, description: 'Client organization that pays for the booking', example: 'org_client' })
  public clientOrganizationId!: string;

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
  @ApiProperty({ type: () => LeadPassengerDto, description: 'Existing Care person or a new primary contact' })
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
