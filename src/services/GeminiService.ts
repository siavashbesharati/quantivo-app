import pino from 'pino';
import { MessageService, ChannelService } from '../database/services';
import { GoogleGenerativeAI } from '@google/generative-ai';

const logger = pino({ level: 'info' });

export class GeminiService {
  private apiKey: string | undefined;
  private messageService: MessageService;
  private channelService: ChannelService;
  private client: GoogleGenerativeAI | null = null;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.messageService = new MessageService();
    this.channelService = new ChannelService();

    if (this.apiKey) {
      try {
        this.client = new GoogleGenerativeAI(this.apiKey);
      } catch (err) {
        logger.error('Failed to initialize GoogleGenerativeAI client:', err);
        this.client = null;
      }
    } else {
      logger.warn('GEMINI_API_KEY not set — GeminiService will return placeholders');
    }
  }

  // Generate a reply using the official client when available; otherwise return a placeholder.
  async generateReply(channelId: string, contactId: string, incomingText: string): Promise<string> {
    const channel = this.channelService.getChannelById(channelId);
    const systemPrompt = channel?.system_prompt || '';

    const prompt = systemPrompt ? `${systemPrompt}\nUser: ${incomingText}` : incomingText;

    if (!this.client) {
      return `Auto-reply placeholder: ${incomingText}`;
    }

    try {
      const modelName = process.env.GEMINI_MODEL || 'gemini-pro';

      const model = this.client.getGenerativeModel({ model: modelName });

      const result = await model.generateContent(prompt);
      const response = result?.response;

      let text = '';
      if (response) {
        text = response.text();
      }

      if (!text) {
        logger.warn('Gemini returned empty text — returning placeholder');
        return `Auto-reply placeholder: ${incomingText}`;
      }

      return text;
    } catch (err) {
      logger.error('Gemini client generation error:', err);
      return `AI generation error`;
    }
  }
}

export default GeminiService;
