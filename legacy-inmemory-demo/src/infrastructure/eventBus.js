import { delay } from './delay.js';

let jobCounter = 1;
let eventCounter = 1;

/**
 * RabbitMQ-style queue: a producer publishes jobs, and a pool of workers
 * competes to pull each job off the queue. Each job is handled exactly once.
 *
 * doc.md: "Producer -> Queue -> Consumer", "Task distribution",
 * "Retrying Failed Jobs" (retry + Dead Letter Queue).
 */
export class Queue {
  constructor(name) {
    this.name = name;
    this.jobs = [];
    this.deadLetterQueue = [];
    this._workers = [];
    this._stopped = false;
  }

  publish(payload) {
    const job = { id: jobCounter++, payload, attempts: 0 };
    this.jobs.push(job);
    console.log(`  [Queue:${this.name}] published job #${job.id} (queue length: ${this.jobs.length})`);
    return job.id;
  }

  /**
   * Registers a worker that continuously pulls jobs off the queue,
   * mirroring doc.md's `while (true) { job = queue.getNextJob(); ... }`.
   */
  registerWorker(name, handler, { maxRetries = 2, retryDelayMs = 200 } = {}) {
    const runLoop = async () => {
      while (!this._stopped) {
        const job = this.jobs.shift();
        if (!job) {
          await delay(30);
          continue;
        }
        try {
          await handler(job.payload, job);
        } catch (err) {
          job.attempts += 1;
          if (job.attempts <= maxRetries) {
            console.log(
              `  [Queue:${this.name}] worker "${name}" failed job #${job.id} (attempt ${job.attempts}/${maxRetries}) - retrying in ${retryDelayMs}ms: ${err.message}`
            );
            await delay(retryDelayMs);
            this.jobs.push(job);
          } else {
            console.log(`  [Queue:${this.name}] job #${job.id} exhausted retries -> moved to Dead Letter Queue`);
            this.deadLetterQueue.push(job);
          }
        }
      }
    };
    runLoop();
  }

  isIdle() {
    return this.jobs.length === 0;
  }

  stop() {
    this._stopped = true;
  }
}

/**
 * Kafka-style topic: a producer publishes an event once, and EVERY subscribed
 * consumer group receives its own independent copy of it. Nobody competes for
 * the event the way they do on a Queue.
 *
 * doc.md: "Kafka focuses on: Broadcasting events ... Many services can
 * consume the same event independently."
 */
export class Topic {
  constructor(name) {
    this.name = name;
    this.subscribers = [];
  }

  subscribe(groupName, handler) {
    this.subscribers.push({ groupName, handler });
    console.log(`  [Topic:${this.name}] consumer group "${groupName}" subscribed`);
  }

  publish(payload) {
    const event = { id: eventCounter++, payload };
    console.log(
      `  [Topic:${this.name}] broadcasting event #${event.id} to ${this.subscribers.length} independent consumer group(s)`
    );
    for (const sub of this.subscribers) {
      // Each subscriber processes the event independently and in parallel.
      Promise.resolve()
        .then(() => sub.handler(event.payload, event))
        .catch((err) =>
          console.log(`  [Topic:${this.name}] consumer group "${sub.groupName}" errored: ${err.message}`)
        );
    }
    return event.id;
  }
}
