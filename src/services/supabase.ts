import { createClient } from '@supabase/supabase-js'

// Use N8N Supabase (tecace service is stopped)
const supabaseUrl = 'https://kvijybrfxukdttijgmwy.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2aWp5YnJmeHVrZHR0aWpnbXd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0NTAxOTksImV4cCI6MjA3ODAyNjE5OX0.UhCp33M2j9PImxtQC5L-hPoMUB2iFlCagEuOh1tcOZE'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Type definitions for our database tables
export interface ChatData {
  id?: number
  request_id: string
  session_id: string
  input_text: string
  output_text: string
  admin_feedback?: AdminFeedbackData | null
  user_feedback?: any | null
  created_at?: string
  updated_at?: string
}

export interface AdminFeedbackData {
  id?: number
  request_id: string
  feedback_verdict: 'good' | 'bad'
  feedback_text: string
  corrected_response?: string | null
  corrected_message?: string | null
  prompt_apply?: boolean
  created_at?: string
  updated_at?: string
}

export interface UserFeedbackData {
  id?: number
  request_id: string
  chat_id?: string
  timestamp: string
  user_name: string
  user_id: string
  conversation_id: string
  reaction: string
  feedback_text?: string | null
  raw_data: any
  created_at?: string
  chat_message?: string | null
  chat_response?: string | null
} 