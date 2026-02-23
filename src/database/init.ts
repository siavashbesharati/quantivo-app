import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DATABASE_PATH || './data/bbidar.db';

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database connection
const db = new Database(DB_PATH);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create schema
export function initializeDatabase(): void {
  // Users Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      subscription_status TEXT DEFAULT 'active',
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Channels Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      session_data TEXT,
      is_active BOOLEAN DEFAULT 1,
      auto_reply_enabled BOOLEAN DEFAULT 1,
      system_prompt TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Messages Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      contact_identifier TEXT NOT NULL,
      content TEXT NOT NULL,
      direction TEXT NOT NULL,
      message_type TEXT DEFAULT 'text',
      ai_response TEXT,
      response_sent BOOLEAN DEFAULT 0,
      metadata TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
    )
  `);

  // Contacts Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      name TEXT,
      phone_number TEXT,
      identifier TEXT NOT NULL,
      email TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for better query performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id);
    CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
    CREATE INDEX IF NOT EXISTS idx_channels_user ON channels(user_id);
    CREATE INDEX IF NOT EXISTS idx_contacts_channel ON contacts(channel_id);
  `);

  console.log('Database initialized successfully at:', DB_PATH);
}

export function getDatabase(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');
  return db;
}

if (require.main === module) {
  initializeDatabase();
}
