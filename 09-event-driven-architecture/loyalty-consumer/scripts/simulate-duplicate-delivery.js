"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const amqplib = __importStar(require("amqplib"));
const RABBITMQ_URL = process.env.RABBITMQ_URL ?? 'amqp://freshcart:freshcart_password@localhost:5672';
const GROCERY_EVENTS_EXCHANGE = 'grocery_events';
const ORDER_PLACED_ROUTING_KEY = 'order.placed';
const LOYALTY_QUEUE = 'loyalty.order-placed.queue';
const DEMO_CUSTOMER_ID = 'demo-customer-idempotency';
async function main() {
    const connection = await amqplib.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertExchange(GROCERY_EVENTS_EXCHANGE, 'topic', { durable: true });
    await channel.assertQueue(LOYALTY_QUEUE, { durable: true });
    await channel.bindQueue(LOYALTY_QUEUE, GROCERY_EVENTS_EXCHANGE, ORDER_PLACED_ROUTING_KEY);
    const eventId = randomUUID();
    const event = {
        eventId,
        eventType: 'order.placed',
        occurredAt: new Date().toISOString(),
        payload: {
            orderId: randomUUID(),
            customerId: DEMO_CUSTOMER_ID,
            items: [{ sku: 'rice-5kg', name: 'Rice 5kg Bag', quantity: 1, unitPrice: 42 }],
            totalAmount: 42,
        },
    };
    const content = Buffer.from(JSON.stringify(event));
    console.log(`Simulating a duplicate delivery of eventId=${eventId} to ${LOYALTY_QUEUE}`);
    console.log(`Expect: exactly one award of ${Math.round(event.payload.totalAmount)} points to ${DEMO_CUSTOMER_ID}\n`);
    console.log('Sending delivery #1...');
    channel.sendToQueue(LOYALTY_QUEUE, content, { persistent: true, contentType: 'application/json' });
    await sleep(500);
    console.log('Sending delivery #2 (identical eventId — simulates redelivery)...');
    channel.sendToQueue(LOYALTY_QUEUE, content, { persistent: true, contentType: 'application/json' });
    await sleep(500);
    console.log(`\nDone. Check: curl http://localhost:${process.env.LOYALTY_CONSUMER_PORT ?? 4104}/points`);
    console.log(`${DEMO_CUSTOMER_ID} should show ${Math.round(event.payload.totalAmount)} points (not ` +
        `${Math.round(event.payload.totalAmount) * 2}), and processedEventCount should have ` +
        'increased by exactly 1, not 2.');
    await channel.close();
    await connection.close();
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function randomUUID() {
    return require('node:crypto').randomUUID();
}
main().catch((err) => {
    console.error('simulate-duplicate-delivery failed:', err);
    process.exit(1);
});
//# sourceMappingURL=simulate-duplicate-delivery.js.map