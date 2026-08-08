import { Injectable, Logger } from '@nestjs/common';
import { NotifierPort } from '../../../core/ports/out/notifier.port';

/** Outbound/driven adapter for NotifierPort — logs to the console instead of sending email/SMS. */
@Injectable()
export class ConsoleNotifierAdapter implements NotifierPort {
  private readonly logger = new Logger('Notifier');

  async notify(customerId: string, message: string): Promise<void> {
    this.logger.log(`[notify -> ${customerId}] ${message}`);
  }
}
