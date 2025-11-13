import { supabaseN8N, PromptData } from './supabaseN8N'

export async function fetchSystemPromptN8N(): Promise<string> {
  try {
    const { data, error } = await supabaseN8N
      .from('prompts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return ''
      }
      throw error
    }

    return data?.prompt_text || ''
  } catch (error) {
    console.error('Error fetching n8n system prompt:', error)
    throw error
  }
}

export async function saveSystemPromptN8N(content: string): Promise<void> {
  try {
    const { error } = await supabaseN8N
      .from('prompts')
      .insert({
        prompt_text: content
      })

    if (error) throw error

    console.log('N8N system prompt saved successfully')
  } catch (error) {
    console.error('Error saving n8n system prompt:', error)
    throw error
  }
}

export async function fetchAllPromptsN8N(): Promise<PromptData[]> {
  try {
    const { data, error } = await supabaseN8N
      .from('prompts')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return data || []
  } catch (error) {
    console.error('Error fetching all prompts:', error)
    throw error
  }
}

export async function deletePromptN8N(promptId: number): Promise<void> {
  try {
    const { error } = await supabaseN8N
      .from('prompts')
      .delete()
      .eq('id', promptId)

    if (error) throw error

    console.log('Prompt deleted successfully')
  } catch (error) {
    console.error('Error deleting prompt:', error)
    throw error
  }
}

