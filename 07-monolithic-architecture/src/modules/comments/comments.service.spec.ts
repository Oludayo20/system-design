import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { Post } from '../posts/entities/post.entity';
import { PostsService } from '../posts/posts.service';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { CommentsService } from './comments.service';
import { Comment } from './entities/comment.entity';

describe('CommentsService', () => {
  let commentsService: CommentsService;
  let commentsRepository: { create: jest.Mock; save: jest.Mock; find: jest.Mock };
  let postsService: { findById: jest.Mock };
  let usersService: { findById: jest.Mock };
  let notificationsService: { notifyNewComment: jest.Mock };

  const post = { id: 'post-1', userId: 'owner-1', title: 'A post about monoliths' } as Post;
  const author = { id: 'commenter-1', displayName: 'Amir Musa' } as User;
  const savedComment = {
    id: 'comment-1',
    postId: 'post-1',
    userId: 'commenter-1',
    body: 'Nice post!',
    createdAt: new Date(),
  } as Comment;

  beforeEach(async () => {
    commentsRepository = {
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn().mockResolvedValue(savedComment),
      find: jest.fn(),
    };
    postsService = { findById: jest.fn().mockResolvedValue(post) };
    usersService = { findById: jest.fn().mockResolvedValue(author) };
    notificationsService = { notifyNewComment: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: getRepositoryToken(Comment), useValue: commentsRepository },
        { provide: PostsService, useValue: postsService },
        { provide: UsersService, useValue: usersService },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    commentsService = moduleRef.get(CommentsService);
  });

  it('calls PostsService.findById() and UsersService.findById() directly, in-process', async () => {
    await commentsService.create('post-1', 'commenter-1', { body: 'Nice post!' });

    expect(postsService.findById).toHaveBeenCalledWith('post-1');
    expect(usersService.findById).toHaveBeenCalledWith('commenter-1');
  });

  it('calls NotificationsService.notifyNewComment() synchronously, before returning', async () => {
    const result = await commentsService.create('post-1', 'commenter-1', { body: 'Nice post!' });

    expect(notificationsService.notifyNewComment).toHaveBeenCalledWith(
      'owner-1',
      'Amir Musa commented on your post "A post about monoliths"',
    );
    expect(result).toEqual(savedComment);
  });

  it('does not notify the post owner when they comment on their own post', async () => {
    await commentsService.create('post-1', 'owner-1', { body: 'Note to self' });

    expect(notificationsService.notifyNewComment).not.toHaveBeenCalled();
  });

  it('propagates NotFoundException from PostsService without saving a comment', async () => {
    postsService.findById.mockRejectedValueOnce(new NotFoundException('Post missing-post not found'));

    await expect(
      commentsService.create('missing-post', 'commenter-1', { body: 'Nice post!' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(commentsRepository.save).not.toHaveBeenCalled();
    expect(notificationsService.notifyNewComment).not.toHaveBeenCalled();
  });
});
