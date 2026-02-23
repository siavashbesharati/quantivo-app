# Bbidar CRM - AI-Powered Multi-Channel Automation

An intelligent CRM system that integrates WhatsApp (via Baileys) and Telegram, powered by Google Gemini AI for automated, contextual responses.

## Features

- **Multi-Channel Support**: WhatsApp and Telegram integration
- **AI-Powered Responses**: Automatic message generation using Google Gemini 3 Pro
- **Session Management**: Persistent session storage for WhatsApp connections
- **Real-Time Updates**: Socket.IO for live message aggregation
- **Secure Authentication**: JWT-based user authentication
- **SQLite Backend**: Lightweight, persistent data storage
- **TypeScript**: Full TypeScript support for type safety

## Tech Stack

- **Backend**: Node.js with TypeScript
- **Database**: SQLite3 (better-sqlite3)
- **WhatsApp**: @whiskeysockets/baileys
- **Telegram**: telegraf
- **AI Engine**: @google/generative-ai (Gemini)
- **Real-time**: Socket.IO
- **Authentication**: JWT + bcrypt

## Installation

1. Clone the repository:
```bash
git clone <repo-url>
cd Bbidar-v2
```

2. Install dependencies:
```bash
npm install
```

3. Setup environment variables:
```bash
cp .env.example .env
```
Update `.env` with your credentials:
- `GEMINI_API_KEY`: Get from [Google AI Studio](https://aistudio.google.com)
- `TELEGRAM_BOT_TOKEN`: Get from BotFather on Telegram
- `JWT_SECRET`: Set a secure random string

4. Initialize database:
```bash
npm run db:init
```

## Running the Server

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

The server will start on `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Channels
- `POST /api/channels` - Create channel
- `GET /api/channels` - Get all user channels
- `GET /api/channels/:id` - Get specific channel
- `PUT /api/channels/:id` - Update channel
- `DELETE /api/channels/:id` - Delete channel

### Messages
- `POST /api/messages` - Create message
- `GET /api/messages/channel/:channel_id` - Get channel messages
- `GET /api/messages/:id` - Get specific message
- `PUT /api/messages/:id` - Update message
- `DELETE /api/messages/:id` - Delete message

## Database Schema

### Users
- `id`: Unique identifier
- `email`: User email
- `password_hash`: Hashed password
- `subscription_status`: Active/inactive
- `role`: user/admin
- `created_at`, `updated_at`: Timestamps

### Channels
- `id`: Unique identifier
- `user_id`: Foreign key to users
- `type`: "whatsapp" or "telegram"
- `name`: Channel name
- `session_data`: Persisted session info
- `is_active`: Channel status
- `auto_reply_enabled`: Auto-response toggle
- `system_prompt`: AI personality/instructions

### Messages
- `id`: Unique identifier
- `channel_id`: Foreign key to channels
- `contact_identifier`: Phone/user ID
- `content`: Message text
- `direction`: "in" or "out"
- `message_type`: Message format
- `ai_response`: Generated response
- `response_sent`: Delivery status

### Contacts
- `id`: Unique identifier
- `channel_id`: Foreign key to channels
- `name`: Contact name
- `phone_number`: Phone number
- `identifier`: Platform-specific ID
- `email`: Contact email

## Development Phases

### Phase 1: ✅ Core Infrastructure
- [x] Node.js server with Express
- [x] JWT Authentication
- [x] SQLite service layer
- [x] Socket.IO setup

### Phase 2: Channel Connection
- [x] WhatsApp QR code generation (implemented in `WhatsAppManager` — QR via Socket.IO)
- [x] Telegram integration (basic Telegraf bot support implemented in `TelegramManager`)
- [x] Session persistence (file-based via Baileys `useMultiFileAuthState`; DB-backed session sync not implemented)

### Phase 3: AI & Auto-Reply Logic
- [ ] Gemini integration
- [ ] Message broker
- [ ] Auto-response system
Note: the DB schema and `messages` table include `ai_response` and `auto_reply_enabled`, but no AI service or auto-reply flow is implemented yet.

### Phase 4: Data Tools
- [ ] Contact scraping
- [ ] Excel/CSV export

Notes & current issues:

- `JWT_EXPIRY` handling: `.env` uses `7d`, but `src/utils/auth.ts` previously cast the value with `Number(...)` which results in `NaN` for non-numeric durations. This has been fixed to accept both numeric seconds and duration strings (e.g. `7d`).
- Telegram integration and Gemini AI service are not implemented — dependencies exist in `package.json` but there are no corresponding service files in `src/services/`.
- Tests & CI: `jest` is present in devDependencies but there are no test files or CI workflow yet.

## Project Structure

```
Bbidar-v2/
├── src/
│   ├── server/
│   │   └── index.ts           # Main server entry
│   ├── database/
│   │   ├── init.ts            # Database initialization
│   │   └── services.ts        # Database operations
│   ├── routes/
│   │   ├── auth.ts            # Authentication endpoints
│   │   ├── channels.ts        # Channel endpoints
│   │   └── messages.ts        # Message endpoints
│   ├── middleware/
│   │   └── auth.ts            # JWT & auth middleware
│   └── utils/
│       └── auth.ts            # Auth utilities
├── data/                       # Database files
├── baileys_sessions/           # WhatsApp sessions
├── package.json
├── tsconfig.json
├── .env                        # Environment variables
└── README.md
```

## Next Steps

1. Install dependencies: `npm install` (completed)
2. Setup `.env` file with API keys (in progress)
3. Run `npm run db:init` to create database
4. Start development server: `npm run dev`
5. Implement Baileys WhatsApp integration
6. Implement Telegraf Telegram integration (basic manager implemented)
7. Add per-channel Telegram linking route: POST `/api/channels/:id/telegram/connect` — accepts `{ token }` and saves it to `session_data` (implemented)
7. Build Gemini AI service
8. Create React/Next.js frontend

## Security Notes

- Change `JWT_SECRET` in production
- Use HTTPS in production
- Validate all user inputs
- Rate limit API endpoints
- Backup database regularly
- Keep dependencies updated

## License

MIT

## Support

For issues and questions, please create an issue in the repository.
