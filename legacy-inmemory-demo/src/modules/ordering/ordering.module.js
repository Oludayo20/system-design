/**
 * Ordering module - doc.md: "Place Order, Cancel Order, Order History."
 *
 * The key idea from doc.md: instead of
 *   await createOrder(); await sendEmail(); // customer waits
 * we save the order, PUBLISH an event, and return immediately. Background
 * workers (inventory, notification, analytics) react independently.
 */
export function createOrderingModule({ db, basket, orderQueue, saleTopic }) {
  let nextOrderId = 1;

  async function placeOrder(userId) {
    const cart = await basket.getCart(userId);
    if (cart.items.length === 0) {
      const err = new Error('Cart is empty');
      err.statusCode = 400;
      throw err;
    }
    const total = await basket.getTotal(userId);

    const startedAt = Date.now();
    const order = {
      id: nextOrderId++,
      userId,
      items: cart.items,
      total,
      status: 'CREATED',
      createdAt: startedAt,
    };
    await db.insert('orders', order);
    console.log(`[Ordering] order #${order.id} saved to PostgreSQL (total: $${total})`);

    // RabbitMQ-style: a job that MUST happen exactly once per order (reduce stock, send receipt).
    orderQueue.publish({ type: 'OrderCreated', orderId: order.id, userId, items: order.items });
    // Kafka-style: an event that MANY independent services care about (analytics, fraud checks, ...).
    saleTopic.publish({ type: 'OrderCreated', orderId: order.id, userId, total });

    console.log(
      `[Ordering] published "OrderCreated" and returning to the customer after ${Date.now() - startedAt}ms - NOT waiting for email/inventory/analytics`
    );
    return order;
  }

  return { placeOrder };
}
