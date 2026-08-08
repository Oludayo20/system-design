import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqp-connection-manager';
import type { ChannelWrapper } from 'amqp-connection-manager';
import type { Channel, ConsumeMessage } from 'amqplib';
import { assertTopology } from './topology';

export type EventHandler<T> = (event: T) => Promise<void>;

@Injectable()
export class RabbitmqService implements OnModuleDestroy {
  private readonly logger = new Logger(RabbitmqService.name);
  private readonly connection: amqp.AmqpConnectionManager;
  private readonly channelWrapper: ChannelWrapper;

  constructor(config: ConfigService) {
    const url = config.get<string>('rabbitmq.url');
    if (!url) {
      throw new Error('RABBITMQ_URL is not configured');
    }

    this.connection = amqp.connect([url]);
    this.connection.on('connect', () => this.logger.log('Connected to RabbitMQ'));
    this.connection.on('disconnect', (params) =>
      this.logger.warn(`Disconnected from RabbitMQ: ${params.err?.message ?? 'unknown reason'}`),
    );

    this.channelWrapper = this.connection.createChannel({
      setup: (channel: Channel) => assertTopology(channel),
    });
  }

  /**
   * Subscribe to this consumer's own queue. No retry/dead-letter topology here on purpose —
   * that mechanism already exists in `03-async-queue-processing`; this project's job is to show
   * fan-out + idempotency + ordering, not re-implement DLQs four times over. A handler that
   * throws simply nacks without requeue (logged, dropped) to keep the demo's failure mode
   * obvious rather than silently retrying forever.
   */
  async consume<T>(queue: string, handler: EventHandler<T>): Promise<void> {
    await this.channelWrapper.addSetup(async (channel: Channel) => {
      await channel.prefetch(5);
      await channel.consume(queue, (msg) => {
        if (!msg) {
          return;
        }
        void this.handleMessage(channel, msg, handler);
      });
    });
  }

  private async handleMessage<T>(
    channel: Channel,
    msg: ConsumeMessage,
    handler: EventHandler<T>,
  ): Promise<void> {
    try {
      const event = JSON.parse(msg.content.toString()) as T;
      await handler(event);
      channel.ack(msg);
    } catch (err) {
      this.logger.error(`Failed to process message, dropping it: ${(err as Error).message}`);
      channel.nack(msg, false, false);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.channelWrapper.close();
    await this.connection.close();
  }
}
