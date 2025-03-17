import express from 'express';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import whatsappService from './services/whatsapp.service';
import messageRoutes from './routes/message.routes';
import { swaggerDocument } from './config/swagger';

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