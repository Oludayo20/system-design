import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BooksService } from './books.service';
import { CreateBookDto } from './dto/create-book.dto';
import { ReserveStockDto } from './dto/reserve-stock.dto';
import { BookResponseDto, ReserveStockResponseDto } from './dto/book-response.dto';

@ApiTags('books')
@Controller('books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a book to the catalog' })
  @ApiBody({ type: CreateBookDto })
  @ApiResponse({ status: 201, type: BookResponseDto })
  create(@Body() dto: CreateBookDto) {
    return this.booksService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all books' })
  @ApiResponse({ status: 200, type: [BookResponseDto] })
  findAll() {
    return this.booksService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single book' })
  @ApiResponse({ status: 200, type: BookResponseDto })
  findOne(@Param('id') id: string) {
    return this.booksService.findOne(id);
  }

  @Post(':id/reserve')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reserve stock for an order (called by order-service, not end users)',
    description:
      'Atomically decrements stock and returns price + remaining stock. ' +
      'This is the ONLY way order-service learns a book\'s price or stock - ' +
      'it has no catalog-db connection string. order-service forwards the ' +
      'caller\'s bearer token here, so this endpoint enforces the same auth ' +
      'as everything else.',
  })
  @ApiBody({ type: ReserveStockDto })
  @ApiResponse({ status: 200, type: ReserveStockResponseDto })
  reserve(@Param('id') id: string, @Body() dto: ReserveStockDto) {
    return this.booksService.reserve(id, dto.quantity);
  }
}
