import { MAX_DELIVERY_ATTEMPTS } from './topology';

/**
 * Pure decision function: given how many delivery attempts a job has now had, should it be
 * routed to the dead letter queue instead of retried again? Kept dependency-free (no channel,
 * no broker) so it is unit-testable without a live RabbitMQ connection.
 */
export function shouldDeadLetter(
  attempt: number,
  maxAttempts: number = MAX_DELIVERY_ATTEMPTS,
): boolean {
  return attempt >= maxAttempts;
}

/**
 * The retry count travels as a message header (rather than, say, encoded into the payload)
 * because it's transport metadata, not domain data — this way worker handlers never need to
 * know or unwrap it, and the same header shape works for every queue in the topology.
 */
export function nextAttempt(headers: Record<string, unknown> | undefined): number {
  const current = headers?.['x-retry-count'];
  return (typeof current === 'number' ? current : 0) + 1;
}
