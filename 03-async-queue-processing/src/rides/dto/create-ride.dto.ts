import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';

export class CreateRideDto {
  @ApiProperty({ example: 'rider-42' })
  @IsString()
  @IsNotEmpty()
  riderId: string;

  @ApiProperty({ example: 'driver-7' })
  @IsString()
  @IsNotEmpty()
  driverId: string;

  @ApiProperty({ example: 24.5, description: 'Fare in the local currency, e.g. USD' })
  @IsNumber()
  @IsPositive()
  fare: number;

  @ApiProperty({ example: 'Ikeja, Lagos' })
  @IsString()
  @IsNotEmpty()
  pickupLocation: string;

  @ApiProperty({ example: 'Lekki, Lagos' })
  @IsString()
  @IsNotEmpty()
  dropoffLocation: string;
}
