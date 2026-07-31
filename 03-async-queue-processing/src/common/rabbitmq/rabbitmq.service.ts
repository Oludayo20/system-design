import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqp-connection-manager';
import type { ChannelWrapper } from 'amqp-connection-manager';
import type { Channel, ConsumeMessage } from 'amqplib';
import { assertTopology } from './topology';

export type MessageHandler = (channel: Channel, msg: ConsumeMessage) => Promise<void>;

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
      confirm: true,
      setup: (channel: Channel) => assertTopology(channel),
    });
  }

  /** Publish to an exchange (fan-out entry point, e.g. ride_events / ride.completed). */
  async publish(
    exchange: string,
    routingKey: string,
    payload: unknown,
    headers: Record<string, unknown> = {},
  ): Promise<void> {
    const content = Buffer.from(JSON.stringify(payload));
    await this.channelWrapper.publish(exchange, routingKey, content, {
      persistent: true,
      contentType: 'application/json',
      headers,
    });
  }

  /** Publish straight to a named queue — used for retry/dead-letter requeueing. */
  async sendToQueue(
    queue: string,
    content: Buffer,
    headers: Record<string, unknown> = {},
  ): Promise<void> {
    await this.channelWrapper.sendToQueue(queue, content, {
      persistent: true,
      contentType: 'application/json',
      headers,
    });
  }

  /**
   * Registers a raw consumer via addSetup so it is re-applied automatically on reconnect,
   * which is the pattern amqp-connection-manager expects for anything stateful on the channel.
   */
  async consume(queue: string, prefetch: number, handler: MessageHandler): Promise<void> {
    await this.channelWrapper.addSetup(async (channel: Channel) => {
      await channel.prefetch(prefetch);
      await channel.consume(queue, (msg) => {
        if (!msg) {
          return;
        }
        void handler(channel, msg);
      });
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.channelWrapper.close();
    await this.connection.close();
  }
}
