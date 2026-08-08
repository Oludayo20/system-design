/** DI token the core defines and outbound adapters are bound to — see app.module.ts. */
export const NOTIFIER_PORT = Symbol('NOTIFIER_PORT');

/** Output port: what the core needs to tell a customer something happened. */
export interface NotifierPort {
  notify(customerId: string, message: string): Promise<void>;
}
