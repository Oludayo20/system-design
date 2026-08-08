import express, { Request, Response } from 'express';

const PORT = Number(process.env.PORT ?? 4004);

interface Notification {
  id: string;
  type: string;
  userId: string;
  message: string;
  metadata?: Record<string, unknown>;
  sentAt: string;
}

/**
 * Deliberately no database. This service's entire job in the lesson is to
 * demonstrate that a service can be simple (in-memory state, no
 * persistence layer at all) as long as nothing else in the system depends
 * on it staying up - order-service's fire-and-forget call (with a short
 * timeout + swallowed errors) is what makes that true. Restarting this
 * container wipes its history; that is an acceptable, intentional
 * tradeoff for a demo notification log, not an oversight.
 */
const notifications: Notification[] = [];
let nextId = 1;

const app = express();
app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'notification-service' });
});

app.post('/notifications', (req: Request, res: Response) => {
  const { type, userId, message, metadata } = req.body ?? {};

  if (typeof type !== 'string' || typeof userId !== 'string' || typeof message !== 'string') {
    res.status(400).json({
      statusCode: 400,
      message: 'type, userId, and message are required strings',
    });
    return;
  }

  const notification: Notification = {
    id: String(nextId++),
    type,
    userId,
    message,
    metadata,
    sentAt: new Date().toISOString(),
  };
  notifications.push(notification);

  // eslint-disable-next-line no-console
  console.log(`[notification-service] sent: ${notification.type} -> ${notification.userId}`);

  res.status(201).json(notification);
});

app.get('/notifications', (_req: Request, res: Response) => {
  res.json(notifications);
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[notification-service] listening on port ${PORT}`);
});
