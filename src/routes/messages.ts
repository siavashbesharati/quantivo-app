import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { MessageService, ChannelService } from '../database/services';
import { Parser } from 'json2csv';

const router = Router();
const messageService = new MessageService();
const channelService = new ChannelService();

// Use auth middleware for all message routes
router.use(authMiddleware);

// Create message
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { channel_id, contact_identifier, content, direction, message_type, metadata } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!channel_id || !contact_identifier || !content || !direction) {
      res.status(400).json({ error: 'channel_id, contact_identifier, content, and direction are required' });
      return;
    }

    // Verify channel belongs to user
    const channel = channelService.getChannelById(channel_id);
    if (!channel || channel.user_id !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const message = messageService.createMessage(
      channel_id,
      contact_identifier,
      content,
      direction,
      message_type || 'text',
      metadata
    );

    res.status(201).json({
      message: 'Message created successfully',
      data: message,
    });
  } catch (error) {
    console.error('Create message error:', error);
    res.status(500).json({ error: 'Failed to create message' });
  }
});

// Get messages for a channel
router.get('/channel/:channel_id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { channel_id } = req.params;
    const userId = req.user?.userId;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Verify channel belongs to user
    const channel = channelService.getChannelById(channel_id);
    if (!channel || channel.user_id !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const messages = messageService.getMessagesByChannel(channel_id, limit, offset);

    res.status(200).json({
      messages,
      count: messages.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to retrieve messages' });
  }
});

// Get single message
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const message = messageService.getMessageById(id);

    if (!message) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    // Verify channel belongs to user
    const channel = channelService.getChannelById(message.channel_id);
    if (!channel || channel.user_id !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.status(200).json({ message });
  } catch (error) {
    console.error('Get message error:', error);
    res.status(500).json({ error: 'Failed to retrieve message' });
  }
});

// Update message
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const message = messageService.getMessageById(id);

    if (!message) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    // Verify channel belongs to user
    const channel = channelService.getChannelById(message.channel_id);
    if (!channel || channel.user_id !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const updatedMessage = messageService.updateMessage(id, req.body);

    res.status(200).json({
      message: 'Message updated successfully',
      data: updatedMessage,
    });
  } catch (error) {
    console.error('Update message error:', error);
    res.status(500).json({ error: 'Failed to update message' });
  }
});

// Delete message
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const message = messageService.getMessageById(id);

    if (!message) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    // Verify channel belongs to user
    const channel = channelService.getChannelById(message.channel_id);
    if (!channel || channel.user_id !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const deleted = messageService.deleteMessage(id);

    if (deleted) {
      res.status(200).json({ message: 'Message deleted successfully' });
    } else {
      res.status(500).json({ error: 'Failed to delete message' });
    }
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// GET /api/messages/channel/:channel_id/export
router.get('/channel/:channel_id/export', authMiddleware, async (req: any, res) => {
  const { channel_id } = req.params;
  const { format = 'csv' } = req.query;

  try {
    const messageService = new MessageService();
    // Fetch all messages for the channel (adjust limit as needed, or implement pagination)
    const messages = messageService.getMessagesByChannel(channel_id, 10000); 

    if (format === 'csv') {
      const fields = ['id', 'channel_id', 'contact_identifier', 'content', 'direction', 'message_type', 'ai_response', 'response_sent', 'timestamp'];
      const parser = new Parser({ fields });
      const csv = parser.parse(messages);

      res.header('Content-Type', 'text/csv');
      res.attachment(`messages-${channel_id}-${Date.now()}.csv`);
      return res.send(csv);
    }

    // Default to JSON if format is not 'csv'
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Error exporting messages', error: (err as Error).message });
  }
});

export default router;
