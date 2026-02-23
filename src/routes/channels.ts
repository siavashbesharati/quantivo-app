import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { ChannelService } from '../database/services';

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

export default router;
