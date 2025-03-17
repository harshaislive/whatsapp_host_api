import makeWASocket, {
  DisconnectReason,
  WASocket,
  downloadContentFromMessage,
  makeInMemoryStore,
  proto,
  useMultiFileAuthState
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import path from 'path';
import fs from 'fs';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { webcrypto } from 'crypto';

// Set crypto for Baileys
if (typeof global.crypto !== 'object') {
  global.crypto = webcrypto as any;
}

class WhatsAppService {
  private sock: WASocket | null = null;
  private store: ReturnType<typeof makeInMemoryStore>;
  private logger: ReturnType<typeof pino>;
  private storeFile: string;
  private storeInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Configure logger
    this.logger = pino({ 
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true
        }
      }
    });
    
    // Set store file path
    this.storeFile = path.resolve('./storage/store.json');
    
    // Configure store
    this.store = makeInMemoryStore({
      logger: this.logger
    });

    // Read store file if it exists
    if (fs.existsSync(this.storeFile)) {
      this.store.readFromFile(this.storeFile);
    }
  }

  private setupStoreInterval() {
    // Clear existing interval if any
    if (this.storeInterval) {
      clearInterval(this.storeInterval);
    }

    // Save store every 60 seconds instead of 10
    this.storeInterval = setInterval(() => {
      // Only write if connected
      if (this.isConnected()) {
        this.store.writeToFile(this.storeFile);
      }
    }, 60_000); // Changed from 10 seconds to 60 seconds
  }

  async connect() {
    const { state, saveCreds } = await useMultiFileAuthState(
      path.resolve(process.env.SESSION_DIR || './storage/sessions')
    );

    // Create WhatsApp connection
    this.sock = makeWASocket({
      auth: state,
      logger: this.logger,
      printQRInTerminal: false // We'll handle QR code display ourselves
    });

    // Bind events
    this.store.bind(this.sock.ev);

    // Setup store interval
    this.setupStoreInterval();

    // Handle connection events
    this.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        // Display QR code
        qrcode.generate(qr, { small: true });
        console.log('Scan the QR code above to login');
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        
        if (shouldReconnect) {
          await this.connect();
        } else {
          console.log('WhatsApp connection closed');
          // Clear store interval on disconnect
          if (this.storeInterval) {
            clearInterval(this.storeInterval);
            this.storeInterval = null;
          }
        }
      }

      if (connection === 'open') {
        console.log('WhatsApp connection established');
      }
    });

    // Handle credentials update
    this.sock.ev.on('creds.update', saveCreds);

    return this.sock;
  }

  async sendMessage(to: string, message: string) {
    if (!this.sock) throw new Error('WhatsApp client not initialized');

    return await this.sock.sendMessage(to, { text: message });
  }

  async sendMedia(to: string, media: { url: string, type: 'image' | 'video' | 'document', caption?: string }) {
    if (!this.sock) throw new Error('WhatsApp client not initialized');

    const message: any = {
      [media.type]: { url: media.url },
      caption: media.caption
    };

    return await this.sock.sendMessage(to, message);
  }

  getSocket() {
    return this.sock;
  }

  isConnected() {
    return this.sock?.user !== undefined;
  }
}

// Create singleton instance
const whatsappService = new WhatsAppService();
export default whatsappService; 