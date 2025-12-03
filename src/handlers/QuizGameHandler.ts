import { Socket, Server } from 'socket.io';
import { SupabaseClient } from '@supabase/supabase-js';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
  SubmitAnswerData,
  LeaderboardEntry,
  ParticipantResult,
} from '../types/socket';
import type {
  QuizSession,
  Question,
  SessionParticipant,
  User,
  QuizAnswer,
} from '../types/database';

export class QuizGameHandler {
  private socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;
  private io: Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;
  private supabase: SupabaseClient;

  constructor(
    socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>,
    io: Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>,
    supabase: SupabaseClient
  ) {
    this.socket = socket;
    this.io = io;
    this.supabase = supabase;
  }

  async handleStartQuiz() {
    try {
      const { session_id, user_id } = this.socket.data;

      // Get session and verify user is host
      const { data: session, error: sessionError } = await this.supabase
        .from('quiz_sessions')
        .select('*')
        .eq('id', session_id)
        .single();

      if (sessionError || !session) {
        this.socket.emit('error', {
          type: 'error',
          message: 'Quiz session not found',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (session.host_user_id !== user_id) {
        this.socket.emit('error', {
          type: 'error',
          message: 'Only the host can start the quiz',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Get questions for the quiz
      const { data: questions, error: questionsError } = await this.supabase
        .from('questions')
        .select('*')
        .eq('quiz_id', session.quiz_id)
        .order('order_index', { ascending: true });

      if (questionsError || !questions || questions.length === 0) {
        this.socket.emit('error', {
          type: 'error',
          message: 'No questions found for this quiz',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Update session status
      await this.supabase
        .from('quiz_sessions')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
          current_question_index: 0,
        })
        .eq('id', session_id);

      // Broadcast quiz started
      this.io.to(session_id).emit('quiz_started', {
        type: 'quiz_started',
        session_id,
        current_question_index: 0,
        total_questions: questions.length,
        timestamp: new Date().toISOString(),
      });

      // Send first question
      await this.sendQuestion(session_id, questions[0], 0, questions.length);
    } catch (error) {
      console.error('Error starting quiz:', error);
      this.socket.emit('error', {
        type: 'error',
        message: 'Failed to start quiz',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async handleSubmitAnswer(data: SubmitAnswerData) {
    try {
      const { session_id, user_id } = this.socket.data;
      const { question_id, answer, time_taken, participant_id } = data;

      // Get question to check correct answer
      const { data: question, error: questionError } = await this.supabase
        .from('questions')
        .select('*')
        .eq('id', question_id)
        .single();

      if (questionError || !question) {
        this.socket.emit('error', {
          type: 'error',
          message: 'Question not found',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Check if answer is correct
      const correctAnswer = question.correct_answer.sort().join(',');
      const userAnswer = answer.sort().join(',');
      const isCorrect = correctAnswer === userAnswer;

      // Calculate points
      const points = this.calculatePoints(isCorrect, time_taken, question.time_limit);

      // Save answer to database
      await this.supabase.from('quiz_answers').insert({
        quiz_session_id: session_id,
        participant_id,
        question_id,
        answer,
        is_correct: isCorrect,
        time_taken,
        points_earned: points,
      });

      // Update participant score
      if (isCorrect) {
        const { data: participant } = await this.supabase
          .from('session_participants')
          .select('total_score')
          .eq('id', participant_id)
          .single();

        if (participant) {
          await this.supabase
            .from('session_participants')
            .update({ total_score: participant.total_score + points })
            .eq('id', participant_id);
        }
      }

      // Broadcast answer submitted
      this.io.to(session_id).emit('answer_submitted', {
        type: 'answer_submitted',
        session_id,
        participant_id,
        question_id,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error submitting answer:', error);
      this.socket.emit('error', {
        type: 'error',
        message: 'Failed to submit answer',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async handleRevealAnswer(data: { question_id: string }) {
    try {
      const { session_id, user_id } = this.socket.data;

      // Verify user is host
      const { data: session } = await this.supabase
        .from('quiz_sessions')
        .select('host_user_id')
        .eq('id', session_id)
        .single();

      if (!session || session.host_user_id !== user_id) {
        this.socket.emit('error', {
          type: 'error',
          message: 'Only the host can reveal answers',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Get question
      const { data: question } = await this.supabase
        .from('questions')
        .select('*')
        .eq('id', data.question_id)
        .single();

      if (!question) {
        return;
      }

      // Get all answers for this question
      const { data: answers } = await this.supabase
        .from('quiz_answers')
        .select(`
          *,
          session_participants!inner(
            id,
            user_id,
            users!inner(username)
          )
        `)
        .eq('question_id', data.question_id)
        .eq('quiz_session_id', session_id);

      // Format results
      const results: ParticipantResult[] = (answers || []).map((a: any) => ({
        participant_id: a.participant_id,
        username: a.session_participants.users.username,
        is_correct: a.is_correct,
        points_earned: a.points_earned,
        time_taken: a.time_taken,
        answer: a.answer,
      }));

      // Get leaderboard
      const leaderboard = await this.calculateLeaderboard(session_id);

      // Broadcast answer revealed
      this.io.to(session_id).emit('answer_revealed', {
        type: 'answer_revealed',
        session_id,
        question_id: data.question_id,
        correct_answer: question.correct_answer,
        results,
        leaderboard,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error revealing answer:', error);
      this.socket.emit('error', {
        type: 'error',
        message: 'Failed to reveal answer',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async handleNextQuestion() {
    try {
      const { session_id, user_id } = this.socket.data;

      // Get session
      const { data: session } = await this.supabase
        .from('quiz_sessions')
        .select('*')
        .eq('id', session_id)
        .single();

      if (!session || session.host_user_id !== user_id) {
        this.socket.emit('error', {
          type: 'error',
          message: 'Only the host can advance questions',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Get all questions
      const { data: questions } = await this.supabase
        .from('questions')
        .select('*')
        .eq('quiz_id', session.quiz_id)
        .order('order_index', { ascending: true });

      if (!questions) {
        return;
      }

      const nextIndex = session.current_question_index + 1;

      if (nextIndex >= questions.length) {
        // Quiz is complete
        await this.endQuiz(session_id);
      } else {
        // Update session
        await this.supabase
          .from('quiz_sessions')
          .update({ current_question_index: nextIndex })
          .eq('id', session_id);

        // Broadcast next question message
        this.io.to(session_id).emit('next_question', {
          type: 'next_question',
          session_id,
          current_question_index: nextIndex,
          total_questions: questions.length,
          timestamp: new Date().toISOString(),
        });

        // Send the question
        await this.sendQuestion(session_id, questions[nextIndex], nextIndex, questions.length);
      }
    } catch (error) {
      console.error('Error advancing to next question:', error);
      this.socket.emit('error', {
        type: 'error',
        message: 'Failed to advance question',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async handleEndQuiz() {
    try {
      const { session_id, user_id } = this.socket.data;

      // Verify user is host
      const { data: session } = await this.supabase
        .from('quiz_sessions')
        .select('host_user_id')
        .eq('id', session_id)
        .single();

      if (!session || session.host_user_id !== user_id) {
        this.socket.emit('error', {
          type: 'error',
          message: 'Only the host can end the quiz',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      await this.endQuiz(session_id);
    } catch (error) {
      console.error('Error ending quiz:', error);
      this.socket.emit('error', {
        type: 'error',
        message: 'Failed to end quiz',
        timestamp: new Date().toISOString(),
      });
    }
  }

  private async endQuiz(session_id: string) {
    // Update session status
    await this.supabase
      .from('quiz_sessions')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString(),
      })
      .eq('id', session_id);

    // Get final leaderboard
    const leaderboard = await this.calculateLeaderboard(session_id);

    // Broadcast quiz completed
    this.io.to(session_id).emit('quiz_completed', {
      type: 'quiz_completed',
      session_id,
      final_leaderboard: leaderboard,
      timestamp: new Date().toISOString(),
    });
  }

  private async sendQuestion(
    session_id: string,
    question: Question,
    currentIndex: number,
    totalQuestions: number
  ) {
    // Randomize options if needed
    const options = question.randomize_options
      ? this.shuffleArray([...question.options])
      : question.options;

    this.io.to(session_id).emit('question', {
      type: 'question',
      session_id,
      question: {
        id: question.id,
        text: question.text,
        question_type: question.question_type,
        options,
        time_limit: question.time_limit,
        order_index: question.order_index,
      },
      current_question_index: currentIndex,
      total_questions: totalQuestions,
      timestamp: new Date().toISOString(),
    });
  }

  private calculatePoints(isCorrect: boolean, timeTaken: number, timeLimit: number): number {
    if (!isCorrect) return 0;

    const basePoints = 500;
    const timeRatio = Math.max(0, 1 - timeTaken / timeLimit);
    const timeBonus = 500 * timeRatio;

    return Math.round(basePoints + timeBonus);
  }

  private async calculateLeaderboard(session_id: string): Promise<LeaderboardEntry[]> {
    const { data: participants } = await this.supabase
      .from('session_participants')
      .select(`
        id,
        user_id,
        total_score,
        users!inner(username)
      `)
      .eq('quiz_session_id', session_id);

    if (!participants) {
      return [];
    }

    const leaderboard: LeaderboardEntry[] = await Promise.all(
      participants.map(async (p: any) => {
        const { data: answers } = await this.supabase
          .from('quiz_answers')
          .select('is_correct, time_taken')
          .eq('participant_id', p.id)
          .eq('quiz_session_id', session_id);

        const correctAnswers = answers?.filter((a) => a.is_correct).length || 0;
        const totalAnswers = answers?.length || 0;
        const avgTime =
          totalAnswers > 0
            ? answers!.reduce((sum, a) => sum + a.time_taken, 0) / totalAnswers
            : 0;

        return {
          participant_id: p.id,
          user_id: p.user_id,
          username: p.users.username,
          total_score: p.total_score,
          correct_answers: correctAnswers,
          total_answers: totalAnswers,
          average_time: Math.round(avgTime * 100) / 100,
        };
      })
    );

    // Sort by score descending, then by average time ascending
    return leaderboard.sort((a, b) => {
      if (b.total_score !== a.total_score) {
        return b.total_score - a.total_score;
      }
      return a.average_time - b.average_time;
    });
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}
