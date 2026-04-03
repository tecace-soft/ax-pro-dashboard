import { supabaseN8N } from './supabaseN8N'

export interface EmailAgentRecipientRow {
	id: string | number
	email_address: string
	created_at?: string
}

export async function fetchEmailAgentRecipientsN8N(): Promise<EmailAgentRecipientRow[]> {
	const { data, error } = await supabaseN8N
		.from('email_agent_recipients')
		.select('id, email_address, created_at')
		.order('created_at', { ascending: true })

	if (error) {
		console.error('Error fetching email_agent_recipients:', error)
		throw error
	}
	return (data ?? []) as EmailAgentRecipientRow[]
}

export async function insertEmailAgentRecipientN8N(
	email_address: string,
): Promise<EmailAgentRecipientRow> {
	const { data, error } = await supabaseN8N
		.from('email_agent_recipients')
		.insert({ email_address: email_address.trim() })
		.select('id, email_address, created_at')
		.single()

	if (error) {
		console.error('Error inserting email_agent_recipients:', error)
		throw error
	}
	return data as EmailAgentRecipientRow
}

export async function updateEmailAgentRecipientN8N(
	id: string | number,
	email_address: string,
): Promise<void> {
	const { error } = await supabaseN8N
		.from('email_agent_recipients')
		.update({ email_address: email_address.trim() })
		.eq('id', id)

	if (error) {
		console.error('Error updating email_agent_recipients:', error)
		throw error
	}
}

export async function deleteEmailAgentRecipientN8N(id: string | number): Promise<void> {
	const { error } = await supabaseN8N.from('email_agent_recipients').delete().eq('id', id)

	if (error) {
		console.error('Error deleting email_agent_recipients:', error)
		throw error
	}
}
