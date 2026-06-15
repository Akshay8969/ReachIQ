import Database from 'better-sqlite3';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const DB_PATH = process.env.DATABASE_PATH || './reachiq.db';

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(path.resolve(DB_PATH));
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  // Drop tables to cleanly apply the multi-tenant migration
  db.exec(`
    DROP TABLE IF EXISTS communication_log;
    DROP TABLE IF EXISTS campaigns;
    DROP TABLE IF EXISTS segments;
    DROP TABLE IF EXISTS orders;
    DROP TABLE IF EXISTS customers;
    DROP TABLE IF EXISTS users;
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      company_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      age INTEGER,
      gender TEXT CHECK(gender IN ('male','female','other')),
      city TEXT,
      total_orders INTEGER DEFAULT 0,
      total_spend REAL DEFAULT 0,
      last_order_date TEXT,
      tags TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(email, user_id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      product_category TEXT NOT NULL,
      status TEXT DEFAULT 'completed' CHECK(status IN ('pending','completed','cancelled','returned')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS segments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      filter_sql TEXT NOT NULL,
      customer_count INTEGER DEFAULT 0,
      created_by TEXT DEFAULT 'manual' CHECK(created_by IN ('ai','manual')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      segment_id TEXT REFERENCES segments(id),
      channel TEXT NOT NULL CHECK(channel IN ('whatsapp','sms','email','rcs')),
      message_template TEXT NOT NULL,
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft','running','completed','failed')),
      sent_count INTEGER DEFAULT 0,
      delivered_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      opened_count INTEGER DEFAULT 0,
      read_count INTEGER DEFAULT 0,
      clicked_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      launched_at TEXT
    );

    CREATE TABLE IF NOT EXISTS communication_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      channel TEXT NOT NULL,
      recipient TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','sent','delivered','failed','opened','read','clicked')),
      sent_at TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_segments_user_id ON segments(user_id);
    CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
    CREATE INDEX IF NOT EXISTS idx_comm_log_user_id ON communication_log(user_id);
    
    CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_comm_log_campaign ON communication_log(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_comm_log_status ON communication_log(status);
  `);
}

export default getDb;
