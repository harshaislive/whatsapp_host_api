import { Router } from 'express';
import whatsappService from '../services/whatsapp-minimal.service';

const router = Router();

// Send text message
router.post('/send', async (req, res) => {
  try {
    const { to, message } = req.body;
    
    if (!to || !message) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Missing required fields'
      });
    }

    const response = await whatsappService.sendMessage(to, message);
    res.json({
      status: 'success',
      message: 'Message sent successfully',
      data: response
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to send message'
    });
  }
});

// Send media message
router.post('/send-media', async (req, res) => {
  try {
    const { to, mediaUrl, type, caption } = req.body;
    
    if (!to || !mediaUrl || !type) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Missing required fields'
      });
    }

    if (!['image', 'video', 'document'].includes(type)) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Invalid media type. Must be one of: image, video, document'
      });
    }

    // Media sending not implemented in minimal service
    return res.status(501).json({ 
      status: 'error',
      message: 'Media sending not implemented in minimal service'
    });
    
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to send media'
    });
  }
});

// NEW ENDPOINT: List all available chats (not implemented in minimal service)
router.get('/chats', async (req, res) => {
  try {
    res.status(501).json({
      status: 'error',
      message: 'Chat listing not implemented in minimal service'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to list chats'
    });
  }
});

// NEW ENDPOINT: Fetch chat history (not implemented in minimal service)
router.get('/history/:jid', async (req, res) => {
  try {
    res.status(501).json({
      status: 'error',
      message: 'Chat history fetching not implemented in minimal service'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to fetch chat history'
    });
  }
});

export default router; 