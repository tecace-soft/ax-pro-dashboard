import { createClient } from '@supabase/supabase-js'

const supabaseN8NUrl = 'https://kvijybrfxukdttijgmwy.supabase.co'
const supabaseN8NAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2aWp5YnJmeHVrZHR0aWpnbXd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0NTAxOTksImV4cCI6MjA3ODAyNjE5OX0.UhCp33M2j9PImxtQC5L-hPoMUB2iFlCagEuOh1tcOZE'

export const supabaseN8N = createClient(supabaseN8NUrl, supabaseN8NAnonKey)

export interface PromptData {
  id?: number
  created_at?: string
  prompt_text: string
}

