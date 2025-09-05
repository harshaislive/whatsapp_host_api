import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import whatsappService from './services/whatsapp-minimal.service';
import messageRoutes from './routes/message.routes';
import testRoutes from './routes/test.routes';
import { swaggerDocument } from './config/swagger';
import QRCode from 'qrcode';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// CORS middleware - configurable from environment
const corsOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
  : true; // Allow all origins if not specified

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Routes
app.use('/api/messages', messageRoutes);
app.use('/api/test', testRoutes);

// Updated QR Code Endpoint to generate image
app.get('/api/qr-code', async (req, res) => {
  const qrString = whatsappService.getQrCodeString();
  if (qrString) {
    try {
      // Generate QR code as a PNG buffer
      const qrBuffer = await QRCode.toBuffer(qrString, {
        type: 'png',
        errorCorrectionLevel: 'L',
        margin: 2,
        width: 256
      });

      // Set proper headers for image caching
      res.set({
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      res.send(qrBuffer);
    } catch (err) {
      console.error("Failed to generate QR code image:", err);
      res.status(500).json({ error: 'Failed to generate QR code image' });
    }
  } else {
    res.status(404).json({ 
      error: 'QR code not available',
      message: 'Either already scanned, connection failed, or still connecting. Try the reset endpoint if needed.'
    });
  }
});

// Reset connection endpoint
app.post('/api/reset-connection', async (req, res) => {
  try {
    await whatsappService.resetConnection();
    res.json({ 
      success: true, 
      message: 'Connection reset initiated. Check QR code endpoint in a few seconds.' 
    });
  } catch (error) {
    console.error('Failed to reset connection:', error);
    res.status(500).json({ 
      error: 'Failed to reset connection',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Force reconnect endpoint that clears sessions
app.post('/api/force-reconnect', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Clear session directory
    const sessionDir = path.resolve('./storage/sessions');
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
    fs.mkdirSync(sessionDir, { recursive: true });
    
    // Reset connection
    await whatsappService.resetConnection();
    
    res.json({ 
      success: true, 
      message: 'Sessions cleared and connection reset. Check QR code endpoint in 5-10 seconds.' 
    });
  } catch (error) {
    console.error('Failed to force reconnect:', error);
    res.status(500).json({ 
      error: 'Failed to force reconnect',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Health check route
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    whatsapp: whatsappService.isConnected() ? 'connected' : 'disconnected'
  });
});

// Debug endpoint
app.get('/api/debug', (req, res) => {
  const status = whatsappService.getConnectionStatus();
  res.json(status);
});

// Get recent messages endpoint (basic implementation)
app.get('/api/messages/recent', async (req, res) => {
  try {
    res.json({ 
      success: true, 
      message: 'Message history not available in minimal mode. Connect to WhatsApp and use the existing message endpoints.',
      count: 0,
      messages: []
    });
  } catch (error) {
    console.error('Failed to fetch recent messages:', error);
    res.status(500).json({ 
      error: 'Failed to fetch messages',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// List chats endpoint (basic implementation)  
app.get('/api/chats', async (req, res) => {
  try {
    res.json({ 
      success: true, 
      message: 'Chat listing not available in minimal mode. Use the existing message endpoints to send messages.',
      count: 0,
      chats: []
    });
  } catch (error) {
    console.error('Failed to list chats:', error);
    res.status(500).json({ 
      error: 'Failed to list chats',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Initialize WhatsApp connection
whatsappService.connect().then(() => {
  console.log('WhatsApp client initialized');
}).catch(console.error);

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`API Documentation available at http://localhost:${port}/api-docs`);
}); 