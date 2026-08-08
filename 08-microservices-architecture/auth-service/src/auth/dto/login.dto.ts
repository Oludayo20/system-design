import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'reader@bookhive.dev' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'hunter22' })
  @IsString()
  @MinLength(8)
  password: string;
}
