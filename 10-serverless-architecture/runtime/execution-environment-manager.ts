import { randomUUID } from 'crypto';
import { FunctionContext, FunctionResponse, Handler } from './types';

export interface ExecutionEnvironmentManagerOptions {
  /** How long an idle instance stays warm before the sweeper evicts it. */
  warmTtlMs: number;
  /** Real, measured extra latency injected on every cold start. */
  coldStartLatencyMs: number;
  /** How often the background sweeper checks for idle instances to evict. */
  sweepIntervalMs?: number;
}

interface ExecutionInstance {
  id: string;
  busy: boolean;
  lastUsed: number;
  createdAt: number;
}

interface FunctionStats {
  invocations: number;
  coldStarts: number;
  warmStarts: number;
  totalBilledMs: number;
}

export interface FunctionStatsSnapshot extends FunctionStats {
  /** Idle, still-warm instances right now (0 means "scaled to zero"). */
  warmInstances: number;
}

export interface InvokeResult {
  functionName: string;
  requestId: string;
  cold: boolean;
  durationMs: number;
  billedMs: number;
  instanceId: string;
  response: FunctionResponse;
}

/**
 * The actual emulator. Every trigger (HTTP, schedule, queue, file-drop) calls into this SAME
 * manager — proving that triggers are just different front doors to one runtime, exactly like
 * real Lambda: API Gateway, EventBridge, SQS, and S3 notifications all ultimately call the same
 * invoke API against the same execution-environment pool.
 *
 * Mechanics reproduced for real (not just logged):
 *  - Warm reuse: an idle instance younger than `warmTtlMs` is reused with no extra latency.
 *  - Cold start: no idle instance exists (or it aged out), so a NEW instance is created, its
 *    module cache entry is evicted and re-required (re-running the module's top-level "init"
 *    code — connection setup, config loading, etc., exactly like a fresh Lambda container), and
 *    a real `coldStartLatencyMs` delay is awaited before the handler is allowed to run.
 *  - Scale-to-zero: a background sweeper evicts idle instances past `warmTtlMs`.
 *  - Concurrency scaling: concurrent invocations that find no idle instance each spin up their
 *    own new instance — a burst of N concurrent calls with nothing warm yet produces N cold
 *    starts, same as Lambda scaling out concurrent execution environments.
 *  - Billing: real wall-clock handler duration, rounded up to the nearest 100ms ("billed
 *    duration"), accumulated per function.
 */
export class ExecutionEnvironmentManager {
  private readonly registry = new Map<string, string>();
  private readonly instances = new Map<string, ExecutionInstance[]>();
  private readonly stats = new Map<string, FunctionStats>();
  private sweeperHandle: NodeJS.Timeout | null = null;

  constructor(private readonly options: ExecutionEnvironmentManagerOptions) {}

  /** Register a function name against its compiled module path (no extension). */
  register(name: string, modulePath: string): void {
    this.registry.set(name, modulePath);
    this.instances.set(name, []);
    this.stats.set(name, { invocations: 0, coldStarts: 0, warmStarts: 0, totalBilledMs: 0 });
  }

  startSweeper(intervalMs: number = this.options.sweepIntervalMs ?? 5_000): void {
    this.sweeperHandle = setInterval(() => this.sweep(), intervalMs);
    this.sweeperHandle.unref?.();
  }

  stopSweeper(): void {
    if (this.sweeperHandle) {
      clearInterval(this.sweeperHandle);
      this.sweeperHandle = null;
    }
  }

  private sweep(): void {
    const now = Date.now();
    for (const [name, list] of this.instances) {
      const survivors: ExecutionInstance[] = [];
      for (const instance of list) {
        const idleMs = now - instance.lastUsed;
        if (!instance.busy && idleMs > this.options.warmTtlMs) {
          // eslint-disable-next-line no-console
          console.log(
            `[sweeper] evicted ${name} instance=${instance.id} (idle ${idleMs}ms > TTL ${this.options.warmTtlMs}ms) — scaled to zero`,
          );
        } else {
          survivors.push(instance);
        }
      }
      this.instances.set(name, survivors);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async invoke(name: string, event: any): Promise<InvokeResult> {
    const modulePath = this.registry.get(name);
    if (!modulePath) {
      throw new Error(`No function registered as "${name}"`);
    }
    const resolved = require.resolve(modulePath);

    const list = this.instances.get(name)!;
    const now = Date.now();
    const idle = list.find((i) => !i.busy && now - i.lastUsed <= this.options.warmTtlMs);

    let instance: ExecutionInstance;
    let cold: boolean;
    let mod: { handler: Handler };

    if (idle) {
      // Warm path: claim the instance immediately (synchronously, before any await) so a
      // concurrent invocation arriving in the same tick can't also claim it.
      idle.busy = true;
      instance = idle;
      cold = false;
      mod = require(resolved);
    } else {
      // Cold path: spin up a brand-new logical execution environment.
      instance = { id: randomUUID(), busy: true, lastUsed: now, createdAt: now };
      list.push(instance);
      cold = true;

      // Force the module to re-initialize like a fresh container: evict any cached copy so its
      // top-level ("cold init") code runs again.
      delete require.cache[resolved];
      mod = require(resolved);

      // The real, measured cost of a cold start: container/module init time. This is an actual
      // `await`ed delay, not a log line — it shows up in curl timing.
      await sleep(this.options.coldStartLatencyMs);
    }

    const requestId = randomUUID();
    const context: FunctionContext = {
      functionName: name,
      requestId,
      coldStart: cold,
      invokedAt: new Date().toISOString(),
    };

    const invokeStart = Date.now();
    const response = await mod.handler(event, context);
    const durationMs = Date.now() - invokeStart;

    instance.busy = false;
    instance.lastUsed = Date.now();

    // Real AWS Lambda billing granularity: round up to the nearest 100ms, minimum 100ms.
    const billedMs = Math.max(100, Math.ceil(durationMs / 100) * 100);

    const stat = this.stats.get(name)!;
    stat.invocations += 1;
    if (cold) {
      stat.coldStarts += 1;
    } else {
      stat.warmStarts += 1;
    }
    stat.totalBilledMs += billedMs;

    // eslint-disable-next-line no-console
    console.log(
      `[runtime] ${name} req=${requestId} cold=${cold} duration=${durationMs}ms billed=${billedMs}ms instance=${instance.id}`,
    );

    return {
      functionName: name,
      requestId,
      cold,
      durationMs,
      billedMs,
      instanceId: instance.id,
      response,
    };
  }

  getStats(): Record<string, FunctionStatsSnapshot> {
    const out: Record<string, FunctionStatsSnapshot> = {};
    for (const [name, stat] of this.stats) {
      const warmInstances = this.instances.get(name)?.filter((i) => !i.busy).length ?? 0;
      out[name] = { ...stat, warmInstances };
    }
    return out;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
