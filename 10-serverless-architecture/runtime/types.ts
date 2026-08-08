/**
 * Shapes mirror AWS Lambda's real handler signature: `(event, context) => response`.
 * Functions in `functions/` depend ONLY on these types — never on Express, amqplib, or
 * anything else in `runtime/` or `triggers/`. That's what makes them portable units of code
 * instead of framework-coupled route handlers.
 */

export interface FunctionContext {
  functionName: string;
  requestId: string;
  /** True if this invocation ran in a freshly-initialized execution environment. */
  coldStart: boolean;
  invokedAt: string;
}

export interface FunctionResponse {
  statusCode: number;
  /** JSON-encoded string, mirroring API Gateway's Lambda proxy-integration response shape. */
  body: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Handler<TEvent = any> = (
  event: TEvent,
  context: FunctionContext,
) => Promise<FunctionResponse>;
