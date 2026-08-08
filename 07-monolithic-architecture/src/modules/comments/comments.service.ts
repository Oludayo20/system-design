import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { PostsService } from '../posts/posts.service';
import { UsersService } from '../users/users.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { Comment } from './entities/comment.entity';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment) private readonly comments: Repository<Comment>,
    private readonly postsService: PostsService,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * The property the doc.md diagram calls "everything is connected": to add one comment, this
   * method makes three plain, synchronous, in-process calls into three other modules' services
   * — no event bus, no HTTP, no queue between any of them. All four run inside the same request
   * and the same try/catch. If NotificationsService.notifyNewComment() throws, the whole
   * request fails and the comment never gets returned to the caller, even though the comment
   * row and the notification row are unrelated concerns.
   */
  async create(postId: string, userId: string, dto: CreateCommentDto): Promise<Comment> {
    const post = await this.postsService.findById(postId); // throws NotFoundException if missing
    const author = await this.usersService.findById(userId); // fetched only for the notification text

    const comment = await this.comments.save(
      this.comments.create({ postId, userId, body: dto.body }),
    );

    if (post.userId !== userId) {
      await this.notificationsService.notifyNewComment(
        post.userId,
        `${author.displayName} commented on your post "${post.title}"`,
      );
    }

    return comment;
  }

  async findAllForPost(postId: string): Promise<Comment[]> {
    await this.postsService.findById(postId); // 404s if the post doesn't exist
    return this.comments.find({ where: { postId }, order: { createdAt: 'ASC' } });
  }
}
