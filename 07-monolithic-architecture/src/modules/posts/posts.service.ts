import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePostDto } from './dto/create-post.dto';
import { Post } from './entities/post.entity';

@Injectable()
export class PostsService {
  constructor(@InjectRepository(Post) private readonly posts: Repository<Post>) {}

  async create(userId: string, dto: CreatePostDto): Promise<Post> {
    return this.posts.save(this.posts.create({ userId, title: dto.title, body: dto.body }));
  }

  async findAll(): Promise<Post[]> {
    return this.posts.find({ order: { createdAt: 'DESC' } });
  }

  /**
   * Called directly by CommentsService (in-process, not over HTTP) to confirm a post exists
   * before attaching a comment to it.
   */
  async findById(id: string): Promise<Post> {
    const post = await this.posts.findOne({ where: { id } });
    if (!post) {
      throw new NotFoundException(`Post ${id} not found`);
    }
    return post;
  }
}
