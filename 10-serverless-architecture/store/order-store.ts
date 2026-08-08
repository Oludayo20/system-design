/**
 * Stands in for a persistent backing store (e.g. DynamoDB or RDS) that real Lambda functions
 * would use, since execution environments themselves are ephemeral and hold no state between
 * cold starts. This in-memory Map lives at the Node PROCESS level (not per execution instance),
 * which is enough, for a local demo, to make `dailySalesReport` demonstrably read what
 * `createOrder` wrote across many separate invocations.
 *
 * This is a plain data module — no Express, no runtime types — so it can be imported by
 * function handlers without pulling any framework code into them.
 */

export interface OrderItem {
  sku: string;
  qty: number;
}

export interface Order {
  id: string;
  customerId: string;
  items: OrderItem[];
  total: number;
  createdAt: string;
}

const orders: Order[] = [];
let counter = 0;

const UNIT_PRICE = 1_000; // flat price per unit, demo only

export function addOrder(input: { customerId: string; items: OrderItem[] }): Order {
  counter += 1;
  const total = input.items.reduce((sum, item) => sum + item.qty * UNIT_PRICE, 0);
  const order: Order = {
    id: `order_${counter}`,
    customerId: input.customerId,
    items: input.items,
    total,
    createdAt: new Date().toISOString(),
  };
  orders.push(order);
  return order;
}

export function listOrders(): Order[] {
  return [...orders];
}

export function summarizeOrders(): { ordersProcessed: number; totalRevenue: number } {
  return {
    ordersProcessed: orders.length,
    totalRevenue: orders.reduce((sum, order) => sum + order.total, 0),
  };
}
