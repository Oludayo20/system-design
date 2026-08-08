import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqp-connection-manager';
import type { ChannelWrapper } from 'amqp-connection-manager';
import type { Channel } from 'amqplib';
import { assertTopology } from './topology';

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

  /**
   * Publish an event to the grocery_events exchange and return. order-api never awaits a
   * consumer — this resolves once RabbitMQ has confirmed it accepted the message, nothing more.
   */
  async publish(exchange: string, routingKey: string, payload: unknown): Promise<void> {
    const content = Buffer.from(JSON.stringify(payload));
    await this.channelWrapper.publish(exchange, routingKey, content, {
      persistent: true,
      contentType: 'application/json',
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.channelWrapper.close();
    await this.connection.close();
  }
}
