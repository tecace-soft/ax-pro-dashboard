import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zbubxrrufictliqnqxiu.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpidWJ4cnJ1ZmljdGxpcW5xeGl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyMTQyNzMsImV4cCI6MjA3MDc5MDI3M30.Pasb5l4sUBTxU4l7Y1xwuxkwqKA9b2l07UYHIx1bGY8'

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
  created_at?: string
  updated_at?: string
}

export interface UserFeedbackData {
  id?: number
  request_id: string
  timestamp: string
  user_name: string
  user_id: string
  conversation_id: string
  reaction: string
  feedback_text?: string | null
  raw_data: any
  created_at?: string
} 