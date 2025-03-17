import { Request, Response } from 'express';
import whatsappService from '../services/whatsapp.service';

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({
        status: false,
        message: 'Missing required fields: to, message'
      });
    }

    const result = await whatsappService.sendMessage(to, message);
    
    return res.json({
      status: true,
      message: 'Message sent successfully',
      data: result
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return res.status(500).json({
      status: false,
      message: 'Failed to send message',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const sendMedia = async (req: Request, res: Response) => {
  try {
    const { to, mediaUrl, type, caption } = req.body;

    if (!to || !mediaUrl || !type) {
      return res.status(400).json({
        status: false,
        message: 'Missing required fields: to, mediaUrl, type'
      });
    }

    const result = await whatsappService.sendMedia(to, {
      url: mediaUrl,
      type,
      caption
    });

    return res.json({
      status: true,
      message: 'Media sent successfully',
      data: result
    });
  } catch (error) {
    console.error('Error sending media:', error);
    return res.status(500).json({
      status: false,
      message: 'Failed to send media',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}; 