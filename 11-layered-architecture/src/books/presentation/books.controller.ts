import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateBookUseCase } from '../application/create-book.use-case';
import { GetBookUseCase } from '../application/get-book.use-case';
import { ListBooksUseCase } from '../application/list-books.use-case';
import { Book } from '../domain/book.entity';
import { BookResponseDto } from './dto/book-response.dto';
import { CreateBookDto } from './dto/create-book.dto';

/**
 * Presentation layer. Talks only to the Application layer's use cases — never touches
 * the Domain layer or a repository directly.
 */
@ApiTags('books')
@Controller('books')
export class BooksController {
  constructor(
    private readonly createBookUseCase: CreateBookUseCase,
    private readonly listBooksUseCase: ListBooksUseCase,
    private readonly getBookUseCase: GetBookUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Add a book to the catalog' })
  @ApiResponse({ status: 201, description: 'Book created.', type: BookResponseDto })
  create(@Body() dto: CreateBookDto): Promise<Book> {
    return this.createBookUseCase.execute(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List every book in the catalog' })
  @ApiResponse({ status: 200, type: [BookResponseDto] })
  list(): Promise<Book[]> {
    return this.listBooksUseCase.execute();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single book by id' })
  @ApiResponse({ status: 200, type: BookResponseDto })
  @ApiResponse({ status: 404, description: 'No book with this id.' })
  get(@Param('id') id: string): Promise<Book> {
    return this.getBookUseCase.execute(id);
  }
}
