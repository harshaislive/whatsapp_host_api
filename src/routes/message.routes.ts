import { Router } from 'express';
import { sendMessage, sendMedia } from '../controllers/message.controller';

const router = Router();

// Send text message
router.post('/send', sendMessage);

// Send media message
router.post('/send-media', sendMedia);

export default router; 