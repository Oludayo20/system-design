import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateUserDto } from './dto/create-user.dto';
import { ShardDistributionResponseDto } from './dto/shard-distribution-response.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a user. Generates a global id, then routes to one shard.' })
  @ApiResponse({ status: 201, type: UserResponseDto })
  create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.create(dto);
  }

  @Get('_debug/distribution')
  @ApiOperation({
    summary: 'DEBUG/OPS ONLY: COUNT(*) on every shard to visualize load distribution.',
    description:
      'The one endpoint in this service allowed to query every shard. Never used on the hot path.',
  })
  @ApiResponse({ status: 200, type: ShardDistributionResponseDto })
  getDistribution(): Promise<ShardDistributionResponseDto> {
    return this.usersService.getShardDistribution();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetch a user. Resolves the owning shard and queries only that one.' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiResponse({ status: 404, description: 'User not found on its resolved shard.' })
  findById(@Param('id') id: string): Promise<UserResponseDto> {
    return this.usersService.findById(id);
  }
}
