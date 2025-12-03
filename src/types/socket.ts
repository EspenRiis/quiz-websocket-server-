import { Question } from './database';

// Client -> Server events
export interface ClientToServerEvents {
  start_quiz: () => void;
  submit_answer: (data: SubmitAnswerData) => void;
  reveal_answer: (data: { question_id: string }) => void;
  next_question: () => void;
  end_quiz: () => void;
}

// Server -> Client events
export interface ServerToClientEvents {
  player_joined: (data: PlayerJoinedMessage) => void;
  quiz_started: (data: QuizStartedMessage) => void;
  question: (data: QuestionMessage) => void;
  answer_submitted: (data: AnswerSubmittedMessage) => void;
  answer_revealed: (data: AnswerRevealedMessage) => void;
  next_question: (data: NextQuestionMessage) => void;
  quiz_completed: (data: QuizCompletedMessage) => void;
  error: (data: ErrorMessage) => void;
}

export interface SocketData {
  session_id: string;
  user_id: string;
}

// Message types
export interface SubmitAnswerData {
  question_id: string;
  answer: string[];
  time_taken: number;
  participant_id: string;
}

export interface PlayerJoinedMessage {
  type: 'player_joined';
  session_id: string;
  user_id: string;
  participant_count: number;
  timestamp: string;
}

export interface QuizStartedMessage {
  type: 'quiz_started';
  session_id: string;
  current_question_index: number;
  total_questions: number;
  timestamp: string;
}

export interface QuestionMessage {
  type: 'question';
  session_id: string;
  question: {
    id: string;
    text: string;
    question_type: string;
    options: string[];
    time_limit: number;
    order_index: number;
  };
  current_question_index: number;
  total_questions: number;
  timestamp: string;
}

export interface AnswerSubmittedMessage {
  type: 'answer_submitted';
  session_id: string;
  participant_id: string;
  question_id: string;
  timestamp: string;
}

export interface AnswerRevealedMessage {
  type: 'answer_revealed';
  session_id: string;
  question_id: string;
  correct_answer: string[];
  results: ParticipantResult[];
  leaderboard: LeaderboardEntry[];
  timestamp: string;
}

export interface NextQuestionMessage {
  type: 'next_question';
  session_id: string;
  current_question_index: number;
  total_questions: number;
  timestamp: string;
}

export interface QuizCompletedMessage {
  type: 'quiz_completed';
  session_id: string;
  final_leaderboard: LeaderboardEntry[];
  timestamp: string;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
  timestamp: string;
}

export interface ParticipantResult {
  participant_id: string;
  username: string;
  is_correct: boolean;
  points_earned: number;
  time_taken: number;
  answer: string[];
}

export interface LeaderboardEntry {
  participant_id: string;
  user_id: string;
  username: string;
  total_score: number;
  correct_answers: number;
  total_answers: number;
  average_time: number;
}
