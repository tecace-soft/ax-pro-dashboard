const API_BASE = '/api'

interface RequestDetailResponse {
	request: {
		outputText: string
		inputText: string
		requestId: number
		sessionId: string
		[key: string]: any
	}
}

export async function fetchRequestDetail(
	authToken: string,
	requestId: string
): Promise<RequestDetailResponse> {
	const queryString = new URLSearchParams({
		requestId: requestId
	}).toString()

	try {
		const response = await fetch(`${API_BASE}/evaluation/request/detail/?${queryString}`, {
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${authToken}`,
				'accept': 'application/json',
			}
		})

		if (!response.ok) {
			throw new Error(`Request detail API failed: ${response.status} ${response.statusText}`)
		}

		const data: RequestDetailResponse = await response.json()
		return data
	} catch (error) {
		console.error(`Request detail API failed for request ${requestId}:`, error)
		throw error
	}
} 