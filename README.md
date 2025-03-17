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