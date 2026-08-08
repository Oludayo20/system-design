import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { ApiMutationErrors, ApiReadErrors } from '../../shared/swagger/api-error.decorators';
import { AuthenticatedUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CommentsService } from './comments.service';
import { CommentResponseDto } from './dto/comment-response.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { Comment } from './entities/comment.entity';

@ApiTags('comments')
@Controller('posts/:id/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Add a comment to a post',
    description:
      'Validates the post exists, saves the comment, and synchronously notifies the post owner ' +
      '— all three steps run in one request against three different modules\' services.',
  })
  @ApiParam({ name: 'id', description: 'Post UUID', format: 'uuid' })
  @ApiBody({ type: CreateCommentDto })
  @ApiResponse({ status: 201, description: 'Comment created.', type: CommentResponseDto })
  @ApiMutationErrors({ auth: true })
  create(
    @Param('id', ParseUUIDPipe) postId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCommentDto,
  ): Promise<Comment> {
    return this.commentsService.create(postId, user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List comments on a post', description: 'Public, no auth required.' })
  @ApiParam({ name: 'id', description: 'Post UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Comments for the post.', type: [CommentResponseDto] })
  @ApiReadErrors()
  findAllForPost(@Param('id', ParseUUIDPipe) postId: string): Promise<Comment[]> {
    return this.commentsService.findAllForPost(postId);
  }
}
