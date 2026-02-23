import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { ContactService } from '../database/services';
import { Parser } from 'json2csv';

const router = express.Router();

// GET /api/contacts/channel/:channel_id
router.get('/channel/:channel_id', authenticateToken, (req: any, res) => {
    const { channel_id } = req.params;
    try {
        const contactService = new ContactService();
        const contacts = contactService.getContactsByChannel(channel_id);
        res.json(contacts);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching contacts', error: (err as Error).message });
    }
});

// GET /api/contacts/channel/:channel_id/export
router.get('/channel/:channel_id/export', authenticateToken, async (req: any, res) => {
    const { channel_id } = req.params;
    const { format = 'csv' } = req.query;

    try {
        const contactService = new ContactService();
        const contacts = contactService.getContactsByChannel(channel_id);

        if (format === 'csv') {
            const fields = ['id', 'channel_id', 'name', 'phone_number', 'identifier', 'email', 'created_at'];
            const parser = new Parser({ fields });
            const csv = parser.parse(contacts);

            res.header('Content-Type', 'text/csv');
            res.attachment(`contacts-${channel_id}-${Date.now()}.csv`);
            return res.send(csv);
        }

        res.json(contacts);
    } catch (err) {
        res.status(500).json({ message: 'Error exporting contacts', error: (err as Error).message });
    }
});

export default router;
