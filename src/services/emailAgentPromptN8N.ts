import { supabaseN8N } from './supabaseN8N'

/** Row shape for `email_agent_prompt` (versioned rows via insert, like `prompts`). */
export interface EmailAgentPromptRow {
	id?: number
	created_at?: string
	prompt_text?: string | null
}

export async function fetchLatestEmailAgentPromptN8N(): Promise<string> {
	try {
		const { data, error } = await supabaseN8N
			.from('email_agent_prompt')
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
		console.error('Error fetching email_agent_prompt:', error)
		throw error
	}
}

export async function saveEmailAgentPromptN8N(content: string): Promise<void> {
	try {
		const { error } = await supabaseN8N.from('email_agent_prompt').insert({
			prompt_text: content,
		})

		if (error) throw error
	} catch (error) {
		console.error('Error saving email_agent_prompt:', error)
		throw error
	}
}
