import { Router } from 'express';
import whatsappService from '../services/whatsapp.service';
import supabase from '../services/supabase.service';

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

    const response = await whatsappService.sendMedia(to, {
      url: mediaUrl,
      type,
      caption
    });
    
    res.json({
      status: 'success',
      message: 'Media sent successfully',
      data: response
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to send media'
    });
  }
});

// NEW ENDPOINT: List all available chats
router.get('/chats', async (req, res) => {
  try {
    const chats = await whatsappService.listAllChats();
    
    res.json({
      status: 'success',
      data: chats
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to list chats'
    });
  }
});

// NEW ENDPOINT: Fetch chat history for a specific JID and save to Supabase
router.get('/history/:jid', async (req, res) => {
  try {
    const { jid } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    
    if (!jid) {
      return res.status(400).json({ 
        status: 'error',
        message: 'JID is required'
      });
    }

    const messages = await whatsappService.fetchChatHistory(jid, limit);
    
    res.json({
      status: 'success',
      message: `${messages.length} messages processed and saved to Supabase`,
      count: messages.length
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to fetch chat history'
    });
  }
});

// NEW ENDPOINT: Fetch formatted daily conversations for a specific JID
router.get('/formatted-history/:jid', async (req, res) => {
  try {
    const { jid } = req.params;
    const date = req.query.date as string; // Optional date filter (YYYY-MM-DD)
    const limit = parseInt(req.query.limit as string) || 7; // Default to 7 days
    
    if (!jid) {
      return res.status(400).json({ 
        status: 'error',
        message: 'JID is required'
      });
    }

    // First, make sure we've fetched history
    await whatsappService.fetchChatHistory(jid, 100); // Fetch 100 messages to ensure we have data
    
    // Query Supabase for the formatted conversations
    const { data, error } = await supabase
      .from('whatsapp_daily_conversations')
      .select('*')
      .eq('chat_jid', jid)
      .order('chat_date', { ascending: false })
      .limit(limit);
    
    if (error) {
      return res.status(500).json({
        status: 'error',
        message: `Failed to retrieve formatted conversations: ${error.message}`
      });
    }
    
    // If specific date requested, filter results
    if (date) {
      const filteredData = data.filter((item: any) => item.chat_date === date);
      return res.json({
        status: 'success',
        data: filteredData
      });
    }
    
    res.json({
      status: 'success',
      data: data
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to fetch formatted history'
    });
  }
});

export default router; 