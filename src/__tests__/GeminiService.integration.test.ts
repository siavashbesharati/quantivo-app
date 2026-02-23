
import dotenv from 'dotenv';
import path from 'path';
import { GeminiService } from '../services/GeminiService';
import { ChannelService, Channel } from '../database/services';

// Load environment variables from the root .env file
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Mock the database services to isolate the Gemini service logic
jest.mock('../database/services');

const MockedChannelService = jest.mocked(ChannelService);

// Conditionally run tests that require an API key
const describeWithApiKey = process.env.GEMINI_API_KEY ? describe : describe.skip;

describeWithApiKey('GeminiService Integration Tests', () => {
  let geminiService: GeminiService;
  let mockChannelServiceInstance: jest.Mocked<ChannelService>;

  beforeAll(() => {
    // Use the real GeminiService for integration testing
    geminiService = new GeminiService();
  });

  beforeEach(() => {
    // Clear mock history before each test
    jest.clearAllMocks();
    MockedChannelService.mockClear();

    // Re-create a fresh mock instance for each test
    mockChannelServiceInstance = new (ChannelService as jest.Mock<ChannelService>)() as jest.Mocked<ChannelService>;
    // Mock the specific method we need for the test
    mockChannelServiceInstance.getChannelById = jest.fn();
    (ChannelService as jest.Mock).mockReturnValue(mockChannelServiceInstance);
  });

  test('should generate a valid, non-empty reply from the Gemini API', async () => {
    const channelId = 'test-channel-1';
    const contactId = 'test-contact-1';
    const incomingText = 'Hello Gemini, please introduce yourself.';
    const systemPrompt = 'You are a helpful and friendly AI assistant.';

    // Mock the service to provide a channel with a system prompt
    const mockChannel: Partial<Channel> = {
      id: channelId,
      system_prompt: systemPrompt,
    };
    mockChannelServiceInstance.getChannelById.mockReturnValue(mockChannel as Channel);

    const reply = await geminiService.generateReply(channelId, contactId, incomingText);

    // Assertions
    expect(reply).toBeDefined();
    expect(typeof reply).toBe('string');
    expect(reply.length).toBeGreaterThan(0);
    expect(reply).not.toContain('Auto-reply placeholder');

    // Verify that the channel was correctly fetched
    expect(mockChannelServiceInstance.getChannelById).toHaveBeenCalledWith(channelId);
    expect(mockChannelServiceInstance.getChannelById).toHaveBeenCalledTimes(1);
  }, 30000); // 30-second timeout to allow for network latency
});

describe('GeminiService Offline Tests', () => {
  let originalApiKey: string | undefined;

  beforeAll(() => {
    // Temporarily remove the API key to test fallback behavior
    originalApiKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  afterAll(() => {
    // Restore the original API key
    process.env.GEMINI_API_KEY = originalApiKey;
  });

  test('should return a placeholder message if the API key is not configured', async () => {
    // Instantiate service without an API key
    const geminiService = new GeminiService();
    const reply = await geminiService.generateReply('offline-channel', 'offline-contact', 'some text');

    // Assert that the fallback message is returned
    expect(reply).toContain('Auto-reply placeholder');
  });
});
