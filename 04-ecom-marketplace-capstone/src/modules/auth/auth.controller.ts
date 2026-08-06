import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  ApiConflictError,
  ApiServerError,
  ApiUnauthorizedError,
  ApiValidationErrors,
} from '../../common/swagger/api-error.decorators';
import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new user',
    description:
      '1. Generates `userId` (shard key).\n' +
      '2. Writes User + Wallet (with signup bonus) on the resolved shard.\n' +
      '3. Writes email→shard entry on primary `user_directory`.\n' +
      '4. Issues JWT.\n\n' +
      'If step 3 fails, compensates by deleting the shard row.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  @ApiValidationErrors()
  @ApiConflictError('Email already registered.')
  @ApiServerError()
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Log in with email and password',
    description:
      'Resolves shard via `user_directory` on primary Postgres, then queries exactly one shard for the user row.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiValidationErrors()
  @ApiUnauthorizedError('Invalid credentials.')
  @ApiServerError()
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
