import { Body, Controller, Get, Param, ParseUUIDPipe, Post as HttpPost, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { ApiMutationErrors, ApiReadErrors } from '../../shared/swagger/api-error.decorators';
import { AuthenticatedUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePostDto } from './dto/create-post.dto';
import { PostResponseDto } from './dto/post-response.dto';
import { Post as PostEntity } from './entities/post.entity';
import { PostsService } from './posts.service';

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @HttpPost()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a post', description: 'Owned by the authenticated user.' })
  @ApiBody({ type: CreatePostDto })
  @ApiResponse({ status: 201, description: 'Post created.', type: PostResponseDto })
  @ApiMutationErrors({ auth: true })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePostDto,
  ): Promise<PostEntity> {
    return this.postsService.create(user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all posts', description: 'Public, no auth required.' })
  @ApiResponse({ status: 200, description: 'All posts.', type: [PostResponseDto] })
  @ApiReadErrors()
  findAll(): Promise<PostEntity[]> {
    return this.postsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a post by ID', description: 'Public, no auth required.' })
  @ApiParam({ name: 'id', description: 'Post UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Post found.', type: PostResponseDto })
  @ApiReadErrors()
  findById(@Param('id', ParseUUIDPipe) id: string): Promise<PostEntity> {
    return this.postsService.findById(id);
  }
}
