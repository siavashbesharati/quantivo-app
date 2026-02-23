import makeWASocket, {
  AuthenticationState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  isJidBroadcast,
  makeCacheableSignalKeyStore,
  proto,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { Server as SocketIOServer } from 'socket.io';
import { ChannelService, MessageService, ContactService, Channel } from '../database/services';
import GeminiService from './GeminiService';
import { toDataURL } from 'qrcode';
import { getDatabase } from '../database/init';

// A simple in-memory store for QR codes
const qrStore = new Map<string, string>();

// Custom logger
const logger = pino({
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
    },
  },
});

export class WhatsAppManager {
  private static instances = new Map<string, any>();
  private io: SocketIOServer;
  private channelService: ChannelService;
  private messageService: MessageService;
  private gemini: GeminiService;
  private contactService: ContactService;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.channelService = new ChannelService();
    this.messageService = new MessageService();
    this.contactService = new ContactService();
    this.gemini = new GeminiService();
    logger.info('WhatsAppManager initialized');
  }

  // Initialize all active WhatsApp channels on startup
  async initializeFromDB(): Promise<void> {
    logger.info('Initializing WhatsApp connections from database...');
    const db = getDatabase();
    const channels = db.prepare("SELECT * FROM channels WHERE type = 'whatsapp' AND is_active = 1").all() as Channel[];
    
    for (const channel of channels) {
      logger.info(`Re-initializing connection for channel: ${channel.name} (${channel.id})`);
      await this.connectToWhatsApp(channel.id);
    }
  }

  public static getInstance(channelId: string) {
    return this.instances.get(channelId);
  }

  // Handle connection and authentication
  async connectToWhatsApp(channelId: string): Promise<any> {
    if (WhatsAppManager.instances.has(channelId)) {
      logger.warn(`Connection for channel ${channelId} already exists.`);
      return WhatsAppManager.instances.get(channelId);
    }

    const { state, saveCreds } = await useMultiFileAuthState(
      `./baileys_sessions/${channelId}`
    );

    const { version, isLatest } = await fetchLatestBaileysVersion();
    logger.info(`Using WA version: ${version.join('.')}, isLatest: ${isLatest}`);

    const sock = makeWASocket({
      version,
      logger,
      printQRInTerminal: true, // For debugging
      auth: state,
      getMessage: async (key) => {
        // Implement message store logic if needed
        return { conversation: '' };
      },
    });

    WhatsAppManager.instances.set(channelId, sock);

    // Handle connection events
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        logger.info(`QR code received for channel ${channelId}`);
        qrStore.set(channelId, qr);
        toDataURL(qr, (err, url) => {
          if (err) {
            logger.error('Error generating QR code data URL:', err);
            return;
          }
          this.io.emit(`qr:${channelId}`, { qr: url });
          logger.info(`QR code for channel ${channelId} emitted via Socket.IO`);
        });
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        logger.info(`Connection closed for channel ${channelId} due to: ${lastDisconnect?.error}, reconnecting: ${shouldReconnect}`);
        
        if (shouldReconnect) {
          this.connectToWhatsApp(channelId);
        } else {
          WhatsAppManager.instances.delete(channelId);
          this.channelService.updateChannel(channelId, { is_active: false });
          logger.info(`Connection for channel ${channelId} permanently closed.`);
          this.io.emit(`connection_status:${channelId}`, { status: 'closed' });
        }
      } else if (connection === 'open') {
        logger.info(`WhatsApp connection opened for channel ${channelId}`);
        this.channelService.updateChannel(channelId, { is_active: true });
        qrStore.delete(channelId); // No longer needed
        this.io.emit(`connection_status:${channelId}`, { status: 'open' });
      }
    });

    // Handle credentials update
    sock.ev.on('creds.update', saveCreds);

    // Handle incoming messages
    sock.ev.on('messages.upsert', async (m) => {
      const msg = m.messages[0];
      if (!msg.message || msg.key.fromMe || isJidBroadcast(msg.key.remoteJid || '')) {
        return;
      }
      
      const contactId = msg.key.remoteJid!;
      const messageContent = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
      
      logger.info(`Received message from ${contactId} on channel ${channelId}: "${messageContent}"`);

      // Save message to database and capture created record
      const created = this.messageService.createMessage(
        channelId,
        contactId,
        messageContent,
        'in'
      );

      // Generate AI response (non-blocking)
      (async () => {
        try {
          const aiReply = await this.gemini.generateReply(channelId, contactId, messageContent);
          if (aiReply) {
            this.messageService.updateMessage(created.id, { ai_response: aiReply });

            // Auto-reply if channel has auto_reply_enabled
            const channel = this.channelService.getChannelById(channelId);
            if (channel?.auto_reply_enabled) {
              // Send reply via WhatsApp
              await sock.sendMessage(contactId, { text: aiReply });
              this.messageService.updateMessage(created.id, { response_sent: true });
            }
            // Emit AI response for frontend
            this.io.emit(`message:${channelId}`, {
              contact: contactId,
              content: aiReply,
              direction: 'out',
              ai: true,
            });
          }
        } catch (err) {
          logger.error('Error generating/sending AI reply:', err);
        }
      })();

      // Notify frontend about incoming message
      this.io.emit(`message:${channelId}`, {
        contact: contactId,
        content: messageContent,
        direction: 'in'
      });
    });

    return sock;
  }
}
