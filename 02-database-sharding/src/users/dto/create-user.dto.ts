import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'ada@oja.africa' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Ada Lovelace' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 120)
  displayName!: string;

  @ApiProperty({
    example: 'africa',
    description: 'Free-form region label, e.g. africa/europe/asia',
  })
  @IsString()
  @IsNotEmpty()
  region!: string;
}
