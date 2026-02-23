import Database from 'better-sqlite3';
import { getDatabase } from './init';
import { randomUUID } from 'crypto';

// Type definitions
export interface User {
  id: string;
  email: string;
  password_hash: string;
  subscription_status: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface Channel {
  id: string;
  user_id: string;
  type: string;
  name: string;
  session_data: string | null;
  is_active: boolean;
  auto_reply_enabled: boolean;
  system_prompt: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  channel_id: string;
  contact_identifier: string;
  content: string;
  direction: string;
  message_type: string;
  ai_response: string | null;
  response_sent: boolean;
  metadata: string | null;
  timestamp: string;
}

export interface Contact {
  id: string;
  channel_id: string;
  name: string | null;
  phone_number: string | null;
  identifier: string;
  email: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
}

// User Operations
export class UserService {
  private db: Database.Database;

  constructor() {
    this.db = getDatabase();
  }

  createUser(email: string, password_hash: string, role: string = 'user'): User {
    const id = randomUUID();
    const stmt = this.db.prepare(`
      INSERT INTO users (id, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(id, email, password_hash, role);
    return this.getUserById(id)!;
  }

  getUserById(id: string): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id) as User | null;
  }

  getUserByEmail(email: string): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email) as User | null;
  }

  updateUser(id: string, updates: Partial<User>): User {
    const allowedFields = ['subscription_status', 'password_hash', 'role'];
    const fields = Object.keys(updates).filter((k) => allowedFields.includes(k));
    
    if (fields.length === 0) throw new Error('No valid fields to update');

    const setClauses = fields.map((f) => `${f} = ?`).join(', ');
    const values = fields.map((f) => updates[f as keyof User]);
    
    const stmt = this.db.prepare(`
      UPDATE users SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    stmt.run(...values, id);
    return this.getUserById(id)!;
  }

  deleteUser(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM users WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
}

// Channel Operations
export class ChannelService {
  private db: Database.Database;

  constructor() {
    this.db = getDatabase();
  }

  createChannel(
    userId: string,
    type: string,
    name: string,
    system_prompt?: string
  ): Channel {
    const id = randomUUID();
    const stmt = this.db.prepare(`
      INSERT INTO channels (id, user_id, type, name, system_prompt)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, userId, type, name, system_prompt || null);
    return this.getChannelById(id)!;
  }

  getChannelById(id: string): Channel | null {
    const stmt = this.db.prepare('SELECT * FROM channels WHERE id = ?');
    return stmt.get(id) as Channel | null;
  }

  getChannelsByUserId(userId: string): Channel[] {
    const stmt = this.db.prepare('SELECT * FROM channels WHERE user_id = ? ORDER BY created_at DESC');
    return stmt.all(userId) as Channel[];
  }

  updateChannel(id: string, updates: Partial<Channel>): Channel {
    const allowedFields = ['name', 'session_data', 'is_active', 'auto_reply_enabled', 'system_prompt'];
    const fields = Object.keys(updates).filter((k) => allowedFields.includes(k));
    
    if (fields.length === 0) throw new Error('No valid fields to update');

    const setClauses = fields.map((f) => `${f} = ?`).join(', ');
    const values = fields.map((f) => updates[f as keyof Channel]);
    
    const stmt = this.db.prepare(`
      UPDATE channels SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    stmt.run(...values, id);
    return this.getChannelById(id)!;
  }

  deleteChannel(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM channels WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
}

// Message Operations
export class MessageService {
  private db: Database.Database;

  constructor() {
    this.db = getDatabase();
  }

  createMessage(
    channelId: string,
    contactIdentifier: string,
    content: string,
    direction: string,
    messageType: string = 'text',
    metadata?: string
  ): Message {
    const id = randomUUID();
    const stmt = this.db.prepare(`
      INSERT INTO messages (id, channel_id, contact_identifier, content, direction, message_type, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, channelId, contactIdentifier, content, direction, messageType, metadata || null);
    return this.getMessageById(id)!;
  }

  getMessageById(id: string): Message | null {
    const stmt = this.db.prepare('SELECT * FROM messages WHERE id = ?');
    return stmt.get(id) as Message | null;
  }

  getMessagesByChannel(channelId: string, limit: number = 50, offset: number = 0): Message[] {
    const stmt = this.db.prepare(`
      SELECT * FROM messages WHERE channel_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?
    `);
    return stmt.all(channelId, limit, offset) as Message[];
  }

  updateMessage(id: string, updates: Partial<Message>): Message {
    const allowedFields = ['ai_response', 'response_sent', 'message_type'];
    const fields = Object.keys(updates).filter((k) => allowedFields.includes(k));
    
    if (fields.length === 0) throw new Error('No valid fields to update');

    const setClauses = fields.map((f) => `${f} = ?`).join(', ');
    const values = fields.map((f) => updates[f as keyof Message]);
    
    const stmt = this.db.prepare(`
      UPDATE messages SET ${setClauses} WHERE id = ?
    `);
    stmt.run(...values, id);
    return this.getMessageById(id)!;
  }

  deleteMessage(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM messages WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
}

// Contact Operations
export class ContactService {
  private db: Database.Database;

  constructor() {
    this.db = getDatabase();
  }

  createContact(
    channelId: string,
    identifier: string,
    name?: string,
    phoneNumber?: string,
    email?: string,
    metadata?: string
  ): Contact {
    const id = randomUUID();
    const stmt = this.db.prepare(`
      INSERT INTO contacts (id, channel_id, identifier, name, phone_number, email, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, channelId, identifier, name || null, phoneNumber || null, email || null, metadata || null);
    return this.getContactById(id)!;
  }

  getContactById(id: string): Contact | null {
    const stmt = this.db.prepare('SELECT * FROM contacts WHERE id = ?');
    return stmt.get(id) as Contact | null;
  }

  getContactsByChannel(channelId: string): Contact[] {
    const stmt = this.db.prepare('SELECT * FROM contacts WHERE channel_id = ? ORDER BY created_at DESC');
    return stmt.all(channelId) as Contact[];
  }

  updateContact(id: string, updates: Partial<Contact>): Contact {
    const allowedFields = ['name', 'phone_number', 'email', 'metadata'];
    const fields = Object.keys(updates).filter((k) => allowedFields.includes(k));
    
    if (fields.length === 0) throw new Error('No valid fields to update');

    const setClauses = fields.map((f) => `${f} = ?`).join(', ');
    const values = fields.map((f) => updates[f as keyof Contact]);
    
    const stmt = this.db.prepare(`
      UPDATE contacts SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    stmt.run(...values, id);
    return this.getContactById(id)!;
  }

  deleteContact(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM contacts WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
}
