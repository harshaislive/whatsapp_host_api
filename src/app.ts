import express from 'express';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import whatsappService from './services/whatsapp.service';
import messageRoutes from './routes/message.routes';
import testRoutes from './routes/test.routes';
import { swaggerDocument } from './config/swagger';
import QRCode from 'qrcode';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

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
        margin: 2
      });

      // Send the image buffer as response
      res.type('image/png').send(qrBuffer);
    } catch (err) {
      console.error("Failed to generate QR code image:", err);
      res.status(500).send('Failed to generate QR code image.');
    }
  } else {
    res.status(404).send('QR code not available. Either already scanned or connection failed.');
  }
});

// Health check route
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    whatsapp: whatsappService.isConnected() ? 'connected' : 'disconnected'
  });
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