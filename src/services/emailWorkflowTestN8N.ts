const EMAIL_WORKFLOW_TEST_WEBHOOK_URL =
	'https://n8n.srv1153481.hstgr.cloud/webhook/de9a086e-ad50-41a2-8805-211d9102f6bf'

export async function triggerEmailWorkflowTestGet(): Promise<void> {
	const response = await fetch(EMAIL_WORKFLOW_TEST_WEBHOOK_URL, { method: 'GET' })
	if (!response.ok) {
		throw new Error(`HTTP ${response.status}`)
	}
}
