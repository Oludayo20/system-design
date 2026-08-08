import { BadGatewayException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ReservationResult {
  bookId: string;
  unitPriceCents: number;
  totalCents: number;
  remainingStock: number;
}

/**
 * order-service's ONLY way of learning a book's price or stock. There is
 * no shortcut, no shared table, no read replica of catalog-db - just this
 * HTTP call. If catalog-service is unreachable, placing an order fails
 * loudly right here (unlike the notification call below, this one is NOT
 * fire-and-forget: price/stock correctness matters for the order itself).
 *
 * This is the "Good" half of the README's bad/good example:
 *   Bad:  Orders Service directly queries the Catalog database.
 *   Good: Orders Service calls Catalog Service over HTTP.
 */
@Injectable()
export class CatalogClientService {
  private readonly logger = new Logger(CatalogClientService.name);
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>('catalogServiceUrl')!;
  }

  async reserveStock(
    bookId: string,
    quantity: number,
    authorizationHeader: string,
  ): Promise<ReservationResult> {
    const url = `${this.baseUrl}/books/${bookId}/reserve`;
    let response: Response;

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authorizationHeader,
        },
        body: JSON.stringify({ quantity }),
      });
    } catch (error) {
      this.logger.error(`catalog-service unreachable at ${url}: ${(error as Error).message}`);
      throw new BadGatewayException('catalog-service is unreachable - could not place order');
    }

    if (response.status === 404) {
      throw new NotFoundException(`Book ${bookId} not found in catalog`);
    }
    if (response.status === 409) {
      const body = await response.json().catch(() => ({ message: 'Insufficient stock' }));
      throw new ConflictException(body.message ?? 'Insufficient stock');
    }
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      this.logger.error(`catalog-service returned ${response.status}: ${text}`);
      throw new BadGatewayException('catalog-service rejected the reservation request');
    }

    return (await response.json()) as ReservationResult;
  }
}
