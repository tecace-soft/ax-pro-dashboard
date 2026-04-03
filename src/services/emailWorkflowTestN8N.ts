const EMAIL_WORKFLOW_TEST_WEBHOOK_URL =
	'https://n8n.srv1153481.hstgr.cloud/webhook/de9a086e-ad50-41a2-8805-211d9102f6bf'

export interface EmailWorkflowTestResponse {
	subject: string
	content: string
}

export async function triggerEmailWorkflowTestGet(): Promise<EmailWorkflowTestResponse> {
	const response = await fetch(EMAIL_WORKFLOW_TEST_WEBHOOK_URL, { method: 'GET' })
	if (!response.ok) {
		throw new Error(`HTTP ${response.status}`)
	}
	const text = await response.text()
	if (!text.trim()) {
		return { subject: '', content: '' }
	}
	let data: unknown
	try {
		data = JSON.parse(text) as unknown
	} catch {
		throw new Error('Response was not valid JSON')
	}
	if (data === null || typeof data !== 'object') {
		throw new Error('Unexpected response shape')
	}
	const o = data as Record<string, unknown>
	const subject = typeof o.subject === 'string' ? o.subject : ''
	const content = typeof o.content === 'string' ? o.content : ''
	return { subject, content }
}
