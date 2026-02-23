import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { ChannelService } from '../database/services';
import { WhatsAppManager } from '../services/WhatsAppManager';
import { encryptToken } from '../utils/crypto';
import { Parser } from 'json2csv';
import { GroupParticipant } from '@whiskeysockets/baileys';

const router = Router();
const channelService = new ChannelService();

// Use auth middleware for all channel routes
router.use(authMiddleware);

// Create channel
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type, name, system_prompt } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!type || !name) {
      res.status(400).json({ error: 'Type and name are required' });
      return;
    }

    const channel = channelService.createChannel(userId, type, name, system_prompt);

    res.status(201).json({
      message: 'Channel created successfully',
      channel,
    });
  } catch (error) {
    console.error('Create channel error:', error);
    res.status(500).json({ error: 'Failed to create channel' });
  }
});

// Connect WhatsApp channel and get QR code
router.post('/:id/whatsapp/connect', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const channel = channelService.getChannelById(id);
    if (!channel || channel.user_id !== userId) {
      res.status(403).json({ error: 'Access denied to this channel' });
      return;
    }
    if (channel.type !== 'whatsapp') {
      res.status(400).json({ error: 'This endpoint is only for WhatsApp channels' });
      return;
    }

    // This assumes waManager is accessible. We'll need to pass it to the routes.
    // For now, let's just call the static method for simplicity in generation.
    // A better approach would be dependency injection.
    const waSocket = await req.app.get('waManager').connectToWhatsApp(id);

    res.status(200).json({
      message: 'WhatsApp connection process started. Listen for QR code on Socket.IO.',
    });
  } catch (error) {
    console.error('WhatsApp connect error:', error);
    res.status(500).json({ error: 'Failed to start WhatsApp connection' });
  }
});

// Connect Telegram channel by providing a bot token (saved in channel.session_data)
router.post('/:id/telegram/connect', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { token } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const channel = channelService.getChannelById(id);
    if (!channel || channel.user_id !== userId) {
      res.status(403).json({ error: 'Access denied to this channel' });
      return;
    }
    if (channel.type !== 'telegram') {
      res.status(400).json({ error: 'This endpoint is only for Telegram channels' });
      return;
    }

    if (!token) {
      res.status(400).json({ error: 'Telegram bot token is required in request body as `token`' });
      return;
    }

    // Encrypt and save token to channel.session_data
    const encrypted = encryptToken(token);
    channelService.updateChannel(id, { session_data: encrypted });

    // Start the Telegram bot for this channel
    const tgManager = req.app.get('tgManager');
    if (!tgManager) {
      res.status(500).json({ error: 'Telegram manager not available on server' });
      return;
    }

    await tgManager.connectToTelegram(id);

    res.status(200).json({ message: 'Telegram bot link started and token saved to channel.session_data' });
  } catch (error) {
    console.error('Telegram connect error:', error);
    res.status(500).json({ error: 'Failed to link Telegram bot to channel' });
  }
});

// Get user's channels
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const channels = channelService.getChannelsByUserId(userId);

    res.status(200).json({
      channels,
    });
  } catch (error) {
    console.error('Get channels error:', error);
    res.status(500).json({ error: 'Failed to retrieve channels' });
  }
});

// Get channel by ID
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const channel = channelService.getChannelById(id);

    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    // Check if channel belongs to user
    if (channel.user_id !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.status(200).json({ channel });
  } catch (error) {
    console.error('Get channel error:', error);
    res.status(500).json({ error: 'Failed to retrieve channel' });
  }
});

// Update channel
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const channel = channelService.getChannelById(id);

    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    // Check if channel belongs to user
    if (channel.user_id !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const updatedChannel = channelService.updateChannel(id, req.body);

    res.status(200).json({
      message: 'Channel updated successfully',
      channel: updatedChannel,
    });
  } catch (error) {
    console.error('Update channel error:', error);
    res.status(500).json({ error: 'Failed to update channel' });
  }
});

// Delete channel
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const channel = channelService.getChannelById(id);

    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    // Check if channel belongs to user
    if (channel.user_id !== userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const deleted = channelService.deleteChannel(id);

    if (deleted) {
      res.status(200).json({ message: 'Channel deleted successfully' });
    } else {
      res.status(500).json({ error: 'Failed to delete channel' });
    }
  } catch (error) {
    console.error('Delete channel error:', error);
    res.status(500).json({ error: 'Failed to delete channel' });
  }
});

// Get WhatsApp groups for a channel
router.get('/:id/whatsapp/groups', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const channel = channelService.getChannelById(id);
    if (!channel || channel.user_id !== userId) {
      res.status(403).json({ error: 'Access denied to this channel' });
      return;
    }
    if (channel.type !== 'whatsapp') {
      res.status(400).json({ error: 'This endpoint is only for WhatsApp channels' });
      return;
    }

    const waManager = req.app.get('waManager');
    if (!waManager) {
      res.status(500).json({ error: 'WhatsApp manager not available on server' });
      return;
    }
    
    const groups = await waManager.getGroups(id);
    res.status(200).json({ groups });

  } catch (error) {
    console.error('Get WhatsApp groups error:', error);
    res.status(500).json({ error: 'Failed to retrieve WhatsApp groups' });
  }
});

// Export WhatsApp group members as CSV
router.get('/:id/whatsapp/groups/:groupId/members/export', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, groupId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const channel = channelService.getChannelById(id);
    if (!channel || channel.user_id !== userId) {
      res.status(403).json({ error: 'Access denied to this channel' });
      return;
    }
    if (channel.type !== 'whatsapp') {
      res.status(400).json({ error: 'This endpoint is only for WhatsApp channels' });
      return;
    }

    const waManager = req.app.get('waManager');
    if (!waManager) {
      res.status(500).json({ error: 'WhatsApp manager not available on server' });
      return;
    }

    const members = await waManager.getGroupMembers(id, groupId);

    // Convert to CSV format
    const csvData = members.map((member: GroupParticipant) => ({
      id: member.id,
      admin: member.admin || 'member',
      isSuperAdmin: member.isSuperAdmin || false,
    }));

    const parser = new Parser({ fields: ['id', 'admin', 'isSuperAdmin'] });
    const csv = parser.parse(csvData);

    res.header('Content-Type', 'text/csv');
    res.attachment(`group-members-${groupId}-${Date.now()}.csv`);
    res.send(csv);

  } catch (error) {
    console.error('Export WhatsApp group members error:', error);
    res.status(500).json({ error: 'Failed to export group members' });
  }
});

export default router;
