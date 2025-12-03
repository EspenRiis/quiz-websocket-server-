import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from './types/socket';
import { QuizGameHandler } from './handlers/QuizGameHandler';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// CORS configuration
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
const allowedOrigins = [
  frontendUrl,
  'http://localhost:5174',
  'https://attensi-spin.vercel.app'
];

console.log('🌐 CORS Configuration:');
console.log('   FRONTEND_URL env var:', process.env.FRONTEND_URL);
console.log('   Allowed origins:', allowedOrigins);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn('⚠️  Blocked CORS request from:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase configuration');
  console.error('Please set SUPABASE_URL and SUPABASE_ANON_KEY in .env file');
  process.exit(1);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Initialize Socket.io
const io = new Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>(
  httpServer,
  {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  }
);

// Socket.io connection handler
io.on('connection', (socket) => {
  const { session_id, user_id } = socket.handshake.query;

  if (!session_id || !user_id) {
    console.error('❌ Connection rejected: missing session_id or user_id');
    socket.emit('error', {
      type: 'error',
      message: 'Missing session_id or user_id',
      timestamp: new Date().toISOString(),
    });
    socket.disconnect();
    return;
  }

  console.log(`✅ Client connected: user=${user_id}, session=${session_id}`);

  // Store connection data
  socket.data = {
    session_id: session_id as string,
    user_id: user_id as string,
  };

  // Join the session room
  socket.join(session_id as string);

  // Initialize game handler for this socket
  const gameHandler = new QuizGameHandler(socket, io, supabase);

  // Register event handlers
  socket.on('start_quiz', () => gameHandler.handleStartQuiz());
  socket.on('submit_answer', (data) => gameHandler.handleSubmitAnswer(data));
  socket.on('reveal_answer', (data) => gameHandler.handleRevealAnswer(data));
  socket.on('next_question', () => gameHandler.handleNextQuestion());
  socket.on('end_quiz', () => gameHandler.handleEndQuiz());

  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: user=${user_id}, session=${session_id}`);
  });
});

// Start server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`\n🚀 Quiz WebSocket Server running on port ${PORT}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 CORS enabled for: ${frontendUrl}\n`);
});
