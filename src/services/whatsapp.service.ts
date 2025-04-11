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
import { v4 as uuidv4 } from 'uuid'; // Keep UUID for potential future use, though maybe not needed now
import { setTimeout as sleep } from 'timers/promises'; // Keep sleep for potential future use

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

  // Method to fetch chat history from a specific JID
  async fetchChatHistory(jid: string, limit = 50): Promise<proto.IWebMessageInfo[]> {
    try {
      if (!this.sock) {
        throw new Error('WhatsApp client not initialized');
      }
      
      console.log(`Fetching chat history for ${jid}`);
      
      // Use the store to get messages
      const messages = this.store.messages[jid]?.array.slice(-limit) || [];
      
      console.log(`Found ${messages.length} messages in chat history for ${jid}`);
      
      // Process and save all these messages to Supabase -- NOTE: This processing will no longer save to Supabase
      let processedCount = 0;
      let failedCount = 0;
      
      // Process in smaller batches with delays to avoid rate limits
      const batchSize = 5;
      for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(messages.length/batchSize)}`);
        
        // Process each message in the batch
        const promises = batch.map(async (msg) => {
          try {
            // Skip messages from the user themselves
            if (msg.key.fromMe) return;
            
            // Use the existing function to process each message (but it won't save anymore)
            await this.handleIncomingMessage(msg);
            processedCount++;
          } catch (error) {
            console.error('Failed to process message:', error);
            failedCount++;
          }
        });
        
        await Promise.all(promises);
        
        // Add a delay between batches to avoid rate limits
        if (i + batchSize < messages.length) {
          console.log(`Waiting 2 seconds before processing next batch...`);
          await sleep(2000);
        }
      }
      
      console.log(`Completed processing ${processedCount} messages. Failed: ${failedCount}.`);
      return messages;
    } catch (error) {
      console.error('Error fetching chat history:', error);
      throw error;
    }
  }

  // Method to list all chats
  async listAllChats(): Promise<{jid: string, name?: string, isGroup: boolean}[]> {
    try {
      if (!this.sock) {
        throw new Error('WhatsApp client not initialized');
      }
      
      const chats: {jid: string, name?: string, isGroup: boolean}[] = [];
      
      // Get all chats from the store
      const jids = Object.keys(this.store.messages);
      
      for (const jid of jids) {
        const isGroup = jid.endsWith('@g.us');
        let name: string | undefined;
        
        if (isGroup) {
          try {
            const groupInfo = await this.sock.groupMetadata(jid);
            name = groupInfo.subject;
          } catch (error) {
            console.error(`Error fetching group info for ${jid}:`, error);
          }
        }
        
        chats.push({ jid, name, isGroup });
      }
      
      return chats;
    } catch (error) {
      console.error('Error listing chats:', error);
      return [];
    }
  }

  // >>> ADDED: Function to handle incoming messages <<<
  private async handleIncomingMessage(msg: proto.IWebMessageInfo) {
    try {
      if (!msg.message || !msg.key.remoteJid) {
        console.log('Skipping message without content or sender JID.');
        return;
      }

      const senderJid = msg.key.remoteJid;
      const timestamp = new Date((msg.messageTimestamp as number) * 1000);
      const senderName = msg.pushName || undefined;
      
      // Check if message is from a group
      const isGroup = senderJid.endsWith('@g.us');
      let groupName: string | undefined;

      // Get group name if message is from a group
      if (isGroup && this.sock) {
        try {
          const groupInfo = await this.sock.groupMetadata(senderJid);
          groupName = groupInfo.subject; // This is the group name
          console.log(`Message from group: ${groupName}`);
        } catch (error) {
          console.error('Error fetching group metadata:', error);
        }
      }

      // Determine message type and content (without media download/upload)
      let messageType: string = 'unknown'; // Changed type from SnippetData['message_type'] to string
      let content: string = '';
      let caption: string | undefined = undefined;

      // Use optional chaining for safer access
      if (msg.message?.conversation) {
        messageType = 'text';
        content = msg.message.conversation;
      } else if (msg.message?.extendedTextMessage?.text) {
        messageType = 'text';
        content = msg.message.extendedTextMessage.text;
      } else if (msg.message?.imageMessage) {
        messageType = 'image';
        caption = msg.message.imageMessage.caption || undefined; // Extract image caption
        content = '[Image Media - Not Downloaded]'; // Placeholder for content
      } else if (msg.message?.videoMessage) {
        messageType = 'video';
        caption = msg.message.videoMessage.caption || undefined; // Extract video caption
        content = '[Video Media - Not Downloaded]'; // Placeholder for content
      } else if (msg.message?.documentMessage) {
        messageType = 'document';
        caption = msg.message.documentMessage.caption || undefined; // Extract document caption
        content = '[Document Media - Not Downloaded]'; // Placeholder for content
      }

      if (messageType !== 'unknown' && content) {
        // Log the processed message details instead of saving to Supabase
        console.log(`Processed message: 
          Sender: ${senderJid} (${senderName || 'N/A'})
          Timestamp: ${timestamp}
          Type: ${messageType}
          Content: ${content}
          Caption: ${caption || 'N/A'}
          Group: ${isGroup ? groupName || senderJid : 'N/A'}`);
      } else {
        console.log(`Skipping unsupported message type from ${senderJid}`);
      }
    } catch (error) {
      console.error('Error handling incoming message:', error);
    }
  }
}

// Create singleton instance
const whatsappService = new WhatsAppService();
export default whatsappService; 