import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  ApiNotFoundError,
  ApiServerError,
  ApiUnauthorizedError,
  ApiValidationErrors,
} from '../../common/swagger/api-error.decorators';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserProfileDto } from './dto/user-profile.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/jwt-payload.interface';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Reads from the sharded Users table on the shard resolved by `hash(userId) % 3`.',
  })
  @ApiResponse({ status: 200, type: UserProfileDto })
  @ApiUnauthorizedError()
  @ApiNotFoundError('User not found on shard.')
  @ApiServerError()
  async me(@CurrentUser() user: JwtPayload) {
    const record = await this.usersService.findById(user.sub);
    const { passwordHash, ...safe } = record;
    return safe;
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({ status: 200, type: UserProfileDto })
  @ApiValidationErrors()
  @ApiUnauthorizedError()
  @ApiServerError()
  async updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateUserDto) {
    const record = await this.usersService.updateProfile(user.sub, dto);
    const { passwordHash, ...safe } = record;
    return safe;
  }
}
