import { addOrder, OrderItem } from '../store/order-store';
import { FunctionContext, FunctionResponse } from '../runtime/types';

/**
 * HTTP-triggered function (mounted behind the `apiGateway` trigger as `POST /orders`).
 *
 * Zero framework code in here on purpose: no Express `req`/`res`, no knowledge of HTTP routing.
 * The event/context shape is all this function knows about — the same handler could be deployed
 * behind a real API Gateway without any changes.
 *
 * Module-level "cold init" work: real Lambda functions do this once per fresh execution
 * environment (open a DB connection pool, load config, warm a cache). This line re-runs every
 * time the execution-environment manager evicts this module and re-requires it — i.e. on every
 * cold start, never on a warm reuse.
 */
// eslint-disable-next-line no-console
console.log('[createOrder] cold init: handler module loaded');

interface CreateOrderEvent {
  /** JSON string, mirroring API Gateway's proxy-integration event shape. */
  body: string;
}

interface CreateOrderPayload {
  customerId?: string;
  items?: OrderItem[];
}

export async function handler(
  event: CreateOrderEvent,
  _context: FunctionContext,
): Promise<FunctionResponse> {
  let payload: CreateOrderPayload;
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  if (!payload.customerId || !Array.isArray(payload.items) || payload.items.length === 0) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'customerId and a non-empty items[] are required' }),
    };
  }

  const order = addOrder({ customerId: payload.customerId, items: payload.items });

  return { statusCode: 201, body: JSON.stringify({ order }) };
}
