import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  ApiConflictError,
  ApiServerError,
  ApiUnauthorizedError,
  ApiValidationErrors,
} from '../../shared/swagger/api-error.decorators';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthResult, IdentityService } from './identity.service';

@ApiTags('identity')
@Controller('auth')
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new customer account',
    description:
      'Creates a user in the identity schema, hashes the password with bcrypt, stores a session in Redis, and returns a JWT access token.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'Account created.', type: AuthResponseDto })
  @ApiValidationErrors()
  @ApiConflictError('An account with this email already exists.')
  @ApiServerError()
  register(@Body() dto: RegisterDto): Promise<AuthResult> {
    return this.identityService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Log in with email and password',
    description: 'Validates credentials, refreshes the Redis session, and returns a JWT access token.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful.', type: AuthResponseDto })
  @ApiValidationErrors()
  @ApiUnauthorizedError('Invalid email or password.')
  @ApiServerError()
  login(@Body() dto: LoginDto): Promise<AuthResult> {
    return this.identityService.login(dto);
  }
}
