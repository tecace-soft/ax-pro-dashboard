import { supabase, ChatData } from './supabase'

// Ensure chat data exists for a request (create if it doesn't exist)
export async function ensureChatDataExists(
  requestId: string, 
  sessionId: string, 
  inputText: string, 
  outputText: string
): Promise<ChatData> {
  try {
    // First try to get existing chat data
    const { data: existingData, error: selectError } = await supabase
      .from('chat_data')
      .select('*')
      .eq('request_id', requestId)
      .single()

    if (existingData) {
      // Chat data already exists
      return existingData
    }

    if (selectError && selectError.code !== 'PGRST116') {
      // Error other than "no rows found"
      throw selectError
    }

    // Chat data doesn't exist, create it
    const { data: newData, error: insertError } = await supabase
      .from('chat_data')
      .insert({
        request_id: requestId,
        session_id: sessionId,
        input_text: inputText,
        output_text: outputText
      })
      .select()
      .single()

    if (insertError) throw insertError

    return newData
  } catch (error) {
    console.error('Error ensuring chat data exists:', error)
    throw error
  }
}

// Get existing chat data for a request
export async function getChatData(requestId: string): Promise<ChatData | null> {
  try {
    // First try chat table (N8N), then fallback to chat_data (legacy)
    const { data: chatData, error: chatError } = await supabase
      .from('chat')
      .select('id, created_at, chat_message, response, session_id, user_id, chat_id')
      .or(`chat_id.eq.${requestId},id.eq.${requestId}`)
      .single()

    if (chatData) {
      return {
        request_id: requestId,
        session_id: chatData.session_id || '',
        input_text: chatData.chat_message || '',
        output_text: chatData.response || '',
        created_at: chatData.created_at,
        id: chatData.id
      }
    }

    // If not found in chat and no critical error, try chat_data (legacy)
    if (chatError && chatError.code !== 'PGRST116') {
      console.warn('Error fetching from chat table, falling back to chat_data:', chatError)
    }

    const { data, error } = await supabase
      .from('chat_data')
      .select('*')
      .eq('request_id', requestId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        return null
      }
      throw error
    }

    return data
  } catch (error) {
    console.error('Error fetching chat data:', error)
    throw error
  }
} 