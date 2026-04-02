import { supabaseN8N } from './supabaseN8N'

/** Row shape for `prompt_email_control` (mirrors `prompts`: versioned rows via insert). */
export interface PromptEmailControlRow {
	id?: number
	created_at?: string
	prompt_text?: string | null
}

export async function fetchLatestEmailExtractionPromptN8N(): Promise<string> {
	try {
		const { data, error } = await supabaseN8N
			.from('prompt_email_control')
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
		console.error('Error fetching prompt_email_control:', error)
		throw error
	}
}

export async function saveEmailExtractionPromptN8N(content: string): Promise<void> {
	try {
		const { error } = await supabaseN8N.from('prompt_email_control').insert({
			prompt_text: content,
		})

		if (error) throw error
	} catch (error) {
		console.error('Error saving prompt_email_control:', error)
		throw error
	}
}
