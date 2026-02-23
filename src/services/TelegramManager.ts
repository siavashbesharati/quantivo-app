import { Telegraf } from 'telegraf';
import { Server as SocketIOServer } from 'socket.io';
import { ChannelService, MessageService, ContactService, Channel } from '../database/services';
import pino from 'pino';
import { decryptToken, isEncryptedToken } from '../utils/crypto';
import GeminiService from './GeminiService';

const logger = pino({ level: 'info' });

export class TelegramManager {
  private static instances = new Map<string, any>();
  private io: SocketIOServer;
  private channelService: ChannelService;
  private messageService: MessageService;
  private contactService: ContactService;
  private gemini: GeminiService;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.channelService = new ChannelService();
    this.messageService = new MessageService();
    this.contactService = new ContactService();
    this.gemini = new GeminiService();
    logger.info('TelegramManager initialized');
  }

  // Re-initialize any active Telegram channels from DB
  async initializeFromDB(): Promise<void> {
    logger.info('Initializing Telegram connections from database...');
    const channels = this.channelService.getChannelsByUserId('%');
    // getChannelsByUserId expects a userId, so instead query DB directly for telegram channels
    try {
      const db = require('../database/init').getDatabase();
      const rows: Channel[] = db.prepare("SELECT * FROM channels WHERE type = 'telegram' AND is_active = 1").all();
      for (const channel of rows) {
        logger.info(`Re-initializing Telegram for channel ${channel.id}`);
        await this.connectToTelegram(channel.id);
      }
    } catch (err) {
      logger.error('initializeFromDB (Telegram) error:', err);
    }
  }

  public static getInstance(channelId: string) {
    return this.instances.get(channelId);
  }

  // Connect a single Telegram channel (bot) — uses channel.session_data as token if present, otherwise env token
  async connectToTelegram(channelId: string): Promise<any> {
    if (TelegramManager.instances.has(channelId)) {
      logger.warn(`Telegram connection for ${channelId} already exists.`);
      return TelegramManager.instances.get(channelId);
    }

    const channel = this.channelService.getChannelById(channelId);
    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }

    let token = (channel.session_data && String(channel.session_data)) || process.env.TELEGRAM_BOT_TOKEN;
    if (token && isEncryptedToken(token)) {
      token = decryptToken(token);
    }
    if (!token) {
      throw new Error('No Telegram bot token available for channel ' + channelId);
    }

    const bot = new Telegraf(token);
    TelegramManager.instances.set(channelId, bot);

    bot.on('text', async (ctx) => {
      try {
        const from = ctx.from;
        const contactId = String(from.id);
        const contactName = from.first_name + (from.last_name ? ` ${from.last_name}` : '');
        const text = 'text' in ctx.message ? ctx.message.text : '';

        // Ensure contact exists, create if not
        let contact = this.contactService.getContactByIdentifier(channelId, contactId);
        if (!contact) {
          contact = this.contactService.createContact(channelId, contactId, contactName);
          logger.info(`New contact created for ${contactId} (${contactName}) on channel ${channelId}`);
        }

        if (!text) return; // Ignore non-text messages for now

        const chatId = String(ctx.chat.id);

        logger.info(`Telegram message on channel ${channelId} from ${chatId}: ${text}`);

        // Save message and capture record
        const created = this.messageService.createMessage(channelId, chatId, text, 'in');

        // Generate AI response (non-blocking)
        (async () => {
          try {
            const aiReply = await this.gemini.generateReply(channelId, chatId, text);
            if (aiReply) {
              this.messageService.updateMessage(created.id, { ai_response: aiReply });
              const channelRec = this.channelService.getChannelById(channelId);
              if (channelRec?.auto_reply_enabled) {
                await bot.telegram.sendMessage(chatId, aiReply);
                this.messageService.updateMessage(created.id, { response_sent: true });
              }
              this.io.emit(`message:${channelId}`, { contact: chatId, content: aiReply, direction: 'out', ai: true });
            }
          } catch (err) {
            logger.error('Error generating/sending AI reply (Telegram):', err);
          }
        })();

        // Emit incoming message to frontend
        this.io.emit(`message:${channelId}`, {
          contact: chatId,
          content: text,
          direction: 'in',
        });
      } catch (err) {
        logger.error('Error handling Telegram text message:', err);
      }
    });

    bot.launch()
      .then(() => {
        logger.info(`Telegram bot launched for channel ${channelId}`);
        this.channelService.updateChannel(channelId, { is_active: true });
        this.io.emit(`connection_status:${channelId}`, { status: 'open' });
      })
      .catch((err) => {
        logger.error('Failed to launch Telegram bot for channel', channelId, err);
      });

    return bot;
  }

  // Optional: send message via bot
  async sendMessage(channelId: string, chatId: string, text: string): Promise<void> {
    const bot = TelegramManager.instances.get(channelId);
    if (!bot) throw new Error('Telegram bot not connected for channel ' + channelId);
    await bot.telegram.sendMessage(chatId, text);
    this.messageService.createMessage(channelId, chatId, text, 'out');
  }
}

export default TelegramManager;
