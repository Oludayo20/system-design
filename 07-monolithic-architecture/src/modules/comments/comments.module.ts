import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications/notifications.module';
import { PostsModule } from '../posts/posts.module';
import { UsersModule } from '../users/users.module';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { Comment } from './entities/comment.entity';

@Module({
  // Comments reaches into three other modules just to add one comment — the "modules importing
  // modules" web the doc warns about: touch Posts, Users, or Notifications and Comments can break.
  imports: [TypeOrmModule.forFeature([Comment]), PostsModule, UsersModule, NotificationsModule],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
