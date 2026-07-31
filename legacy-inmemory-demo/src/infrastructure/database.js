import { delay } from './delay.js';

/**
 * A tiny in-memory stand-in for PostgreSQL.
 * doc.md: "Every module stores its data ... they're all using PostgreSQL."
 * Each module gets its own table but they all live in one logical database.
 */
export class Database {
  constructor(label = 'postgres') {
    this.label = label;
    this.tables = new Map();
  }

  table(name) {
    if (!this.tables.has(name)) this.tables.set(name, []);
    return this.tables.get(name);
  }

  async insert(tableName, record) {
    await delay(20); // simulate a write round-trip
    this.table(tableName).push(record);
    return record;
  }

  async find(tableName, predicate) {
    await delay(20); // simulate a read round-trip
    return this.table(tableName).find(predicate);
  }

  findAll(tableName, predicate = () => true) {
    return this.table(tableName).filter(predicate);
  }
}
