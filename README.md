# WhatsApp API Server

A robust REST API server for WhatsApp messaging using the Baileys library. This server provides a simple way to integrate WhatsApp messaging capabilities into your applications.

## Features

- 🚀 WhatsApp Web API integration
- 📝 Send text messages
- 📸 Send media messages (images, videos, documents)
- 💾 Session persistence
- 🔄 Auto-reconnection
- 📚 Swagger API documentation
- 🔒 Built with TypeScript for type safety

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- A WhatsApp account

## Installation

1. Clone the repository:
```bash
git clone https://github.com/harshaislive/whatsapp_host_api.git
cd whatsapp_host_api
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Configure environment variables in `.env`:
```env
PORT=3000
NODE_ENV=development
SESSION_DIR=./storage/sessions
```

## Usage

### Development

Start the server in development mode with hot-reload:
```bash
npm run dev
```

### Production

Start the server in production mode:
```bash
npm start
```

### Build

Compile TypeScript to JavaScript:
```bash
npm run build
```

## API Documentation

Once the server is running, access the Swagger documentation at:
```
http://localhost:3000/api-docs
```

### Key Endpoints

#### Health Check
```
GET /health
```

#### Send Text Message
```
POST /api/messages/send
Content-Type: application/json

{
    "to": "1234567890@s.whatsapp.net",
    "message": "Hello, World!"
}
```

#### Send Media Message
```
POST /api/messages/send-media
Content-Type: application/json

{
    "to": "1234567890@s.whatsapp.net",
    "mediaUrl": "https://example.com/image.jpg",
    "type": "image",
    "caption": "Optional caption"
}
```

#### List Available Chats
```
GET /api/messages/chats
```
Returns a list of all available chats (individual and group) that the WhatsApp client has in memory, including their JIDs and names.

#### Extract Chat History
```
GET /api/messages/history/:jid?limit=50
```
Extracts and saves message history from a specific chat to the connected Supabase database. Replace `:jid` with the WhatsApp ID of the chat (e.g., `1234567890@s.whatsapp.net` for individual chats or `123456789-987654321@g.us` for group chats).

## Message History Extraction

### Overview
This API provides functionality to extract and store messages from your WhatsApp chats. The messages are saved to a Supabase database and any media is uploaded to Supabase Storage.

### How to Use

1. **List Available Chats**
   ```
   GET /api/messages/chats
   ```
   This will return a JSON array of all chats with their JIDs and names.
   
   Example response:
   ```json
   {
     "status": "success",
     "data": [
       {
         "jid": "1234567890@s.whatsapp.net",
         "isGroup": false
       },
       {
         "jid": "123456789-987654321@g.us",
         "name": "My Group Chat",
         "isGroup": true
       }
     ]
   }
   ```

2. **Extract History from a Specific Chat**
   ```
   GET /api/messages/history/:jid?limit=50
   ```
   
   - Replace `:jid` with the WhatsApp JID from the list of chats
   - The `limit` parameter controls how many messages to extract (default: 50)
   
   Example:
   ```
   GET /api/messages/history/1234567890@s.whatsapp.net?limit=100
   ```
   
   Response:
   ```json
   {
     "status": "success",
     "message": "75 messages processed and saved to Supabase",
     "count": 75
   }
   ```

### Limitations

- Only messages received while your server is running will be available for extraction
- Messages are stored in memory and may be lost on server restart (unless you've configured persistent storage)
- Media files must be downloadable by the server to be processed and stored

### Data Structure

Messages are stored in Supabase with the following structure:
- `sender_jid`: The WhatsApp ID of the sender
- `timestamp`: When the message was sent
- `message_type`: Type of message ('text', 'image', 'video', 'document')
- `content`: Text content or Supabase Storage URL for media
- `sender_name`: Name of the sender (if available)
- `caption`: Caption for media messages (if provided)
- `group_name`: Name of the group (for group messages)
- `is_group`: Boolean flag indicating if the message is from a group

## Important Notes

- Phone numbers should be in the format: `[country_code][phone_number]@s.whatsapp.net`
- Supported media types: `image`, `video`, `document`
- Session data is stored in `storage/sessions` directory
- The server maintains connection state and will auto-reconnect if disconnected

## Security Considerations

1. Never commit your `.env` file or session files
2. Implement proper authentication for your API in production
3. Use HTTPS in production
4. Regularly update dependencies for security patches
5. Monitor WhatsApp's terms of service compliance

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Baileys](https://github.com/WhiskeySockets/Baileys) - WhatsApp Web API
- [Express](https://expressjs.com/) - Web framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety 