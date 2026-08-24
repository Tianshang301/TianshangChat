import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'node:fs';
import path from 'node:path';
import * as schema from './schema.js';
import { config } from '../config.js';
import { createLogger } from './logger.js';

const log = createLogger('db');

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });

export const sqlite = new Database(config.databasePath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
sqlite.pragma('busy_timeout = 5000');

export const db = drizzle(sqlite, { schema });

export function runMigrations(): void {
  const migrationsFolder = path.join(__dirname, '..', '..', 'drizzle');
  log.info(`Applying migrations from ${migrationsFolder}`);
  migrate(db, { migrationsFolder });
  log.info('Migrations up to date');
}

export type Db = typeof db;
