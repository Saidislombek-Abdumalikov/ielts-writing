/// <reference types="vite/client" />
/**
 * Supabase Integration Contract & Data Access Layer Interface.
 * Defines the future Supabase PostgreSQL database tables and client configuration.
 */

export interface SupabaseConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export function getSupabaseConfig(): SupabaseConfig {
  return {
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  };
}

export interface DatabaseSchema {
  users: {
    id: string;
    telegram_id?: string | null;
    username: string;
    name: string;
    email?: string | null;
    role: 'STUDENT' | 'TEACHER' | 'ADMIN' | 'SUPER_ADMIN';
    center_id?: string | null;
    teacher_id?: string | null;
    group_id?: string | null;
    created_at: string;
  };
  groups: {
    id: string;
    center_id?: string | null;
    teacher_id: string;
    name: string;
    status: 'active' | 'archived';
    created_at: string;
  };
  tasks: {
    id: string;
    teacher_id: string;
    group_id?: string | null;
    title: string;
    ielts_type: 'task1' | 'task2' | 'mock';
    assignment_mode: string;
    focus_label?: string | null;
    prompt_text: string;
    task1_prompt?: string | null;
    task1_image_url?: string | null;
    task2_prompt?: string | null;
    image_url?: string | null;
    timer_minutes?: number | null;
    start_date?: string | null;
    due_date: string;
    created_at: string;
  };
  submissions: {
    id: string;
    task_id: string;
    student_id: string;
    content: string;
    task1_content?: string | null;
    task2_content?: string | null;
    word_count: number;
    status: 'draft' | 'submitted' | 'graded';
    started_at?: string | null;
    expires_at?: string | null;
    submitted_at?: string | null;
    created_at: string;
  };
  feedback: {
    id: string;
    submission_id: string;
    teacher_id: string;
    band_score: string;
    comments: string;
    created_at: string;
  };
}
