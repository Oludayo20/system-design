import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'ada@oja.dev' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'correct horse battery staple' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Ada Lovelace' })
  @IsString()
  @MinLength(2)
  fullName: string;
}
