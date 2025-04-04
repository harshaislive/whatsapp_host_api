import makeWASocket, {
  AnyMessageContent,
  DisconnectReason,
  WASocket,
  downloadContentFromMessage,
  makeInMemoryStore,
  proto,
  useMultiFileAuthState,
  downloadMediaMessage
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import path from 'path';
import fs from 'fs';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import supabase from './supabase.service'; // Import Supabase client
import { v4 as uuidv4 } from 'uuid'; // Import UUID for filenames

// Define the structure for our snippet data
interface SnippetData {
  sender_jid: string;
  timestamp: Date;
  message_type: 'text' | 'image' | 'video' | 'document' | 'unknown';
  content: string; // Text message or Media URL
  sender_name?: string; // Optional: Sender's push name
  caption?: string; // Optional: Caption for media messages
}

class WhatsAppService {
  private sock: WASocket | null = null;
  private store: ReturnType<typeof makeInMemoryStore>;
  private logger: ReturnType<typeof pino>;
  private storeFile: string;
  private storeInterval: NodeJS.Timeout | null = null;
  private currentQR: string | null = null; // Variable to store the QR string

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

    // >>> ADDED: Listen for incoming messages <<<
    this.sock.ev.on('messages.upsert', async (m) => {
      const msg = m.messages[0];
      if (!msg.message) return; // Ignore empty messages or status updates etc.
      if (msg.key.fromMe) return; // Optional: Ignore messages sent by ourselves

      console.log('Received new message:', JSON.stringify(m, null, 2));
      await this.handleIncomingMessage(msg);
    });
    // >>> END ADDED <<<

    // Handle connection events
    this.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        // Store the QR code string instead of printing
        this.currentQR = qr;
        console.log('QR code generated. Visit /api/qr-code endpoint to get the string for scanning.');
      }

      if (connection === 'close') {
        // Clear QR code when connection closes (unless logged out)
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        if(this.currentQR) {
            console.log('Connection closed, clearing QR code.');
            this.currentQR = null;
        }
        
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
        // Clear QR code once connected
        if(this.currentQR) {
            console.log('Connection open, clearing QR code.');
            this.currentQR = null;
        }
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

  // >>> ADDED: Method to get the current QR code string <<<
  getQrCodeString(): string | null {
      return this.currentQR;
  }
  // >>> END ADDED <<<

  // >>> ADDED: Function to handle incoming messages <<<
  private async handleIncomingMessage(msg: proto.IWebMessageInfo) {
    try {
      // Ensure message and remoteJid exist
      if (!msg.message || !msg.key.remoteJid) {
        console.log('Skipping message without content or sender JID.');
        return;
      }

      const senderJid = msg.key.remoteJid;
      const timestamp = new Date((msg.messageTimestamp as number) * 1000);
      const senderName = msg.pushName || undefined; // Extract pushName, fallback to undefined

      let messageType: SnippetData['message_type'] = 'unknown';
      let content: string = '';
      let caption: string | undefined = undefined; // Variable to hold the caption

      // Use optional chaining for safer access
      if (msg.message?.conversation) {
        messageType = 'text';
        content = msg.message.conversation;
      } else if (msg.message?.extendedTextMessage?.text) {
        messageType = 'text';
        content = msg.message.extendedTextMessage.text;
      } else if (msg.message?.imageMessage) {
        messageType = 'image';
        content = await this.downloadAndUploadMedia(msg, 'image');
        caption = msg.message.imageMessage.caption || undefined; // Extract image caption
      } else if (msg.message?.videoMessage) {
        messageType = 'video';
        content = await this.downloadAndUploadMedia(msg, 'video');
        caption = msg.message.videoMessage.caption || undefined; // Extract video caption
      } else if (msg.message?.documentMessage) {
        messageType = 'document';
        content = await this.downloadAndUploadMedia(msg, 'document');
        caption = msg.message.documentMessage.caption || undefined; // Extract document caption
        // Potentially add file name extraction here if needed
      }

      if (messageType !== 'unknown' && content) {
        const snippetData: SnippetData = {
          sender_jid: senderJid,
          timestamp: timestamp,
          message_type: messageType,
          content: content,
          sender_name: senderName,
          caption: caption, // Include caption here
        };
        await this.saveSnippetToSupabase(snippetData);
      } else {
        console.log(`Skipping unsupported message type from ${senderJid}`);
      }
    } catch (error) {
      console.error('Error handling incoming message:', error);
    }
  }

  // >>> ADDED: Function to download media and upload to Supabase Storage <<<
  private async downloadAndUploadMedia(msg: proto.IWebMessageInfo, type: 'image' | 'video' | 'document'): Promise<string> {
    try {
      // Added null check for msg.message here as well
      const messageContent = msg.message?.imageMessage || msg.message?.videoMessage || msg.message?.documentMessage;
      if (!messageContent) {
        throw new Error('No media content found in message');
      }
      
      // Extract the correct media key based on the message type
      const mediaKey = messageContent.mediaKey;
      const mimetype = messageContent.mimetype;
      const fileExtension = mimetype?.split('/')[1] || ''; // Basic extension extraction
      const filename = `${uuidv4()}${fileExtension ? '.' + fileExtension : ''}`;

      // Download media
      const buffer = await downloadMediaMessage(
          msg, 
          'buffer', 
          {}, 
          { 
            logger: this.logger, 
            reuploadRequest: this.sock!.updateMediaMessage
          }
      );

      if (!(buffer instanceof Buffer)) {
        throw new Error('Failed to download media or buffer is not a Buffer');
      }

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('whatsapp-media') // Your bucket name
        .upload(filename, buffer, {
          contentType: mimetype || undefined,
          upsert: false, // Don't overwrite existing files (optional)
        });

      if (error) {
        throw new Error(`Supabase Storage upload error: ${error.message}`);
      }

      // Get public URL (adjust if using signed URLs)
      const { data: urlData } = supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(data.path);

      if (!urlData || !urlData.publicUrl) {
          throw new Error('Could not get public URL for uploaded media');
      }
      console.log(`Media uploaded: ${urlData.publicUrl}`);
      return urlData.publicUrl;

    } catch (error) {
      console.error('Error downloading or uploading media:', error);
      // Decide how to handle failed media: return placeholder, empty string, or rethrow
      return 'media_upload_failed'; 
    }
  }

  // >>> ADDED: Function to save snippet data to Supabase DB <<<
  private async saveSnippetToSupabase(data: SnippetData) {
    try {
      const { error } = await supabase
        .from('whatsapp_snippets') // Your table name
        .insert([{
          sender_jid: data.sender_jid,
          timestamp: data.timestamp.toISOString(),
          message_type: data.message_type,
          content: data.content,
          sender_name: data.sender_name,
          caption: data.caption, // Include caption in insert
        }]);

      if (error) {
        throw new Error(`Supabase DB insert error: ${error.message}`);
      }
      console.log(`Snippet saved for ${data.sender_jid}`);
    } catch (error) {
      console.error('Error saving snippet to Supabase:', error);
    }
  }
  // >>> END ADDED <<<
}

// Create singleton instance
const whatsappService = new WhatsAppService();
export default whatsappService; 