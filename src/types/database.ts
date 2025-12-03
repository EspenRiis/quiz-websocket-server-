export interface User {
  id: string;
  username: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface Quiz {
  id: string;
  name: string;
  description: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface Question {
  id: string;
  quiz_id: string;
  text: string;
  question_type: 'multiple_choice' | 'true_false';
  options: string[];
  correct_answer: string[];
  time_limit: number;
  order_index: number;
  randomize_options: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuizSession {
  id: string;
  quiz_id: string;
  host_user_id: string;
  status: 'waiting' | 'in_progress' | 'completed';
  current_question_index: number;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionParticipant {
  id: string;
  quiz_session_id: string;
  user_id: string;
  total_score: number;
  joined_at: string;
  created_at: string;
  updated_at: string;
}

export interface QuizAnswer {
  id: string;
  quiz_session_id: string;
  participant_id: string;
  question_id: string;
  answer: string[];
  is_correct: boolean;
  time_taken: number;
  points_earned: number;
  created_at: string;
  updated_at: string;
}
