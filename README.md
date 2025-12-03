# Quiz WebSocket Server (Node.js + Socket.io)

Real-time WebSocket server for Quiz Race gameplay using Socket.io and Supabase.

## Features

- ✅ Real-time multiplayer quiz gameplay
- ✅ Socket.io for WebSocket communication
- ✅ Supabase JavaScript SDK for database
- ✅ TypeScript for type safety
- ✅ No database connection issues (uses Supabase REST API)
- ✅ Easy deployment to Vercel

## Prerequisites

- Node.js 18+
- Supabase project with quiz tables

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your Supabase credentials:
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_ANON_KEY`: Your Supabase anon/public key

3. **Run development server:**
   ```bash
   npm run dev
   ```

   Server will start on `http://localhost:3001`

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run type-check` - Check TypeScript types

## WebSocket Connection

### Connect from Frontend

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001', {
  query: {
    session_id: 'your-session-id',
    user_id: 'your-user-id'
  }
});
```

### Events

#### Client → Server

- `start_quiz` - Host starts the quiz
- `submit_answer` - Player submits an answer
- `reveal_answer` - Host reveals the correct answer
- `next_question` - Host moves to next question
- `end_quiz` - Host ends the quiz early

#### Server → Client

- `player_joined` - New player joined the session
- `quiz_started` - Quiz has started
- `question` - New question sent to all players
- `answer_submitted` - Player submitted an answer
- `answer_revealed` - Correct answer and results revealed
- `next_question` - Moving to next question
- `quiz_completed` - Quiz finished, final leaderboard
- `error` - Error occurred

## Deployment

### Vercel (Recommended)

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Deploy:
   ```bash
   vercel
   ```

3. Set environment variables in Vercel dashboard:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `FRONTEND_URL` (your frontend URL)

### Other Platforms

Can also deploy to:
- Railway.app
- Fly.io
- Render.com
- Heroku

## Architecture

```
src/
├── server.ts              # Main server & Socket.io setup
├── handlers/
│   └── QuizGameHandler.ts # Game logic & event handlers
└── types/
    ├── database.ts        # Supabase database types
    └── socket.ts          # Socket.io event types
```

## Scoring System

- Base points: 500 for correct answer
- Time bonus: Up to 500 additional points
  - Faster answers earn more bonus points
  - Formula: `time_bonus = 500 * (1 - time_taken / time_limit)`
- Maximum: 1000 points per question
- Incorrect: 0 points

## Troubleshooting

### Connection Issues

If WebSocket won't connect:
1. Check CORS configuration in server.ts
2. Verify FRONTEND_URL matches your frontend
3. Ensure port 3001 is not in use

### Supabase Issues

If database queries fail:
1. Verify SUPABASE_URL and SUPABASE_ANON_KEY are correct
2. Check Row Level Security (RLS) policies in Supabase
3. Ensure tables exist: users, quizzes, questions, quiz_sessions, session_participants, quiz_answers

## Development

The server uses `tsx watch` for hot reload during development. Any changes to `.ts` files will automatically restart the server.
