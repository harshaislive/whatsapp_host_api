import makeWASocket, {
  DisconnectReason,
  WASocket,
  useMultiFileAuthState,
  downloadMediaMessage,
  proto
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import path from 'path';
import pino from 'pino';
import supabase from './supabase.service';
import { v4 as uuidv4 } from 'uuid';
import { setTimeout as sleep } from 'timers/promises';

// Define the structure for our snippet data
interface SnippetData {
  sender_jid: string;
  timestamp: Date;
  message_type: 'text' | 'image' | 'video' | 'document' | 'unknown';
  content: string; // Text message or Media URL
  sender_name?: string; // Optional: Sender's push name
  caption?: string; // Optional: Caption for media messages
  group_name?: string; // Add group name field
  is_group?: boolean; // Add flag to identify group messages
}

class WhatsAppMinimalService {
  private sock: WASocket | null = null;
  private logger: ReturnType<typeof pino>;
  private currentQR: string | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor() {
    this.logger = pino({ level: 'info' });
  }

  async connect(): Promise<WASocket> {
    try {
      const { state, saveCreds } = await useMultiFileAuthState(
        path.resolve(process.env.SESSION_DIR || './storage/sessions')
      );

      this.sock = makeWASocket({
        auth: state,
        logger: this.logger,
        browser: ['WhatsApp Host API', 'Chrome', '1.0.0'],
        printQRInTerminal: false
      });

      // Listen for incoming messages
      this.sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return; // Ignore empty messages or status updates etc.
        if (msg.key.fromMe) return; // Optional: Ignore messages sent by ourselves

        console.log('Received new message:', JSON.stringify(m, null, 2));
        await this.handleIncomingMessage(msg);
      });

      // Handle connection events
      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        this.logger.info('Connection update:', { connection, qr: !!qr });

        if (qr) {
          this.currentQR = qr;
          this.reconnectAttempts = 0;
          console.log('QR code generated! Visit /api/qr-code endpoint to get the image for scanning.');
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          
          if (statusCode === DisconnectReason.loggedOut) {
            console.log('Device logged out, clearing QR and resetting attempts');
            this.currentQR = null;
            this.reconnectAttempts = 0;
            setTimeout(() => this.connect(), 1000);
          } else if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = 3000;
            console.log(`Connection failed, retrying in ${delay/1000} seconds... (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            setTimeout(async () => {
              try {
                await this.connect();
              } catch (error) {
                console.error('Reconnection failed:', error);
              }
            }, delay);
          } else {
            console.log('Max reconnection attempts reached. Use force-reconnect endpoint to retry.');
            this.currentQR = null;
          }
        }

        if (connection === 'open') {
          console.log('WhatsApp connection established successfully');
          this.reconnectAttempts = 0;
          this.currentQR = null;
        }

        if (connection === 'connecting') {
          console.log('Connecting to WhatsApp...');
        }
      });

      this.sock.ev.on('creds.update', saveCreds);
      return this.sock;
    } catch (error) {
      this.logger.error('Error during WhatsApp connection:', error);
      throw error;
    }
  }

  async sendMessage(to: string, message: string) {
    if (!this.sock) throw new Error('WhatsApp client not initialized');
    return await this.sock.sendMessage(to, { text: message });
  }

  getSocket() {
    return this.sock;
  }

  isConnected() {
    return this.sock?.user !== undefined;
  }

  getQrCodeString(): string | null {
    return this.currentQR;
  }

  async resetConnection() {
    console.log('Resetting WhatsApp connection...');
    this.currentQR = null;
    this.reconnectAttempts = 0;
    
    if (this.sock) {
      try {
        this.sock.end(undefined);
      } catch (error) {
        console.error('Error ending current connection:', error);
      }
      this.sock = null;
    }
    
    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        console.error('Failed to reconnect after reset:', error);
      }
    }, 2000);
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected(),
      hasSocket: !!this.sock,
      hasQR: !!this.currentQR,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      socketState: this.sock ? 'initialized' : 'null',
      userInfo: this.sock?.user ? 'logged in' : 'not logged in'
    };
  }

  // Function to handle incoming messages
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
          groupName = groupInfo.subject;
          console.log(`Message from group: ${groupName}`);
        } catch (error) {
          console.error('Error fetching group metadata:', error);
        }
      }

      let messageType: SnippetData['message_type'] = 'unknown';
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
        try {
          content = await this.downloadAndUploadMedia(msg, 'image');
          caption = msg.message.imageMessage.caption || undefined;
        } catch (error) {
          console.error('Failed to download image, storing message without media:', error);
          content = 'media_download_failed';
        }
      } else if (msg.message?.videoMessage) {
        messageType = 'video';
        try {
          content = await this.downloadAndUploadMedia(msg, 'video');
          caption = msg.message.videoMessage.caption || undefined;
        } catch (error) {
          console.error('Failed to download video, storing message without media:', error);
          content = 'media_download_failed';
        }
      } else if (msg.message?.documentMessage) {
        messageType = 'document';
        try {
          content = await this.downloadAndUploadMedia(msg, 'document');
          caption = msg.message.documentMessage.caption || undefined;
        } catch (error) {
          console.error('Failed to download document, storing message without media:', error);
          content = 'media_download_failed';
        }
      }

      if (messageType !== 'unknown' && content) {
        const snippetData: SnippetData = {
          sender_jid: senderJid,
          timestamp: timestamp,
          message_type: messageType,
          content: content,
          sender_name: senderName,
          caption: caption,
          group_name: groupName,
          is_group: isGroup
        };
        await this.saveSnippetToSupabase(snippetData);
      } else {
        console.log(`Skipping unsupported message type from ${senderJid}`);
      }
    } catch (error) {
      console.error('Error handling incoming message:', error);
    }
  }

  // Function to download media and upload to Supabase Storage
  private async downloadAndUploadMedia(msg: proto.IWebMessageInfo, type: 'image' | 'video' | 'document'): Promise<string> {
    const messageContent = msg.message?.imageMessage || msg.message?.videoMessage || msg.message?.documentMessage;
    if (!messageContent) {
      throw new Error('No media content found in message');
    }
    
    const mimetype = messageContent.mimetype;
    const fileExtension = mimetype?.split('/')[1] || '';
    const filename = `${uuidv4()}${fileExtension ? '.' + fileExtension : ''}`;

    try {
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

      // Small delay to avoid overwhelming Supabase Storage
      await sleep(500);

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('whatsapp-media')
        .upload(filename, buffer, {
          contentType: mimetype || undefined,
          upsert: false,
        });

      if (error) {
        throw new Error(`Supabase Storage upload error: ${error.message}`);
      }

      // Get public URL
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
      throw error;
    }
  }

  // Function to save snippet data to Supabase DB
  private async saveSnippetToSupabase(data: SnippetData) {
    try {
      const { error } = await supabase
        .from('whatsapp_snippets')
        .insert([{
          sender_jid: data.sender_jid,
          timestamp: data.timestamp.toISOString(),
          message_type: data.message_type,
          content: data.content,
          sender_name: data.sender_name,
          caption: data.caption,
          group_name: data.group_name,
          is_group: data.is_group
        }]);

      if (error) {
        throw new Error(`Supabase DB insert error: ${error.message}`);
      }
      console.log(`✅ Snippet saved to Supabase for ${data.sender_jid}`);
    } catch (error) {
      console.error('❌ Error saving snippet to Supabase:', error);
    }
  }
}

// Create singleton instance
const whatsappMinimalService = new WhatsAppMinimalService();
export default whatsappMinimalService;