const API_BASE = '/api'

interface RequestParams {
	endDate: string
	page: number
	pageSize: number
	startDate: string
	timeUnit: string
	passed?: string
	validationKeyId?: string
	sessionIds: string
}

interface RequestResponse {
	requests: any[]
	meta: {
		startDate: string
		endDate: string
		period: number
		timeUnit: string
		pagination: any
	}
}

export async function fetchSessionRequests(
	authToken: string,
	sessionId: string,
	startDate: string,
	endDate: string
): Promise<RequestResponse> {
	const params: RequestParams = {
		endDate,
		page: 1,
		pageSize: 20,
		startDate,
		timeUnit: 'day',
		passed: '',
		validationKeyId: '',
		sessionIds: sessionId
	}

	const queryString = new URLSearchParams(
		Object.entries(params).reduce((acc, [key, value]) => {
			acc[key] = String(value)
			return acc
		}, {} as Record<string, string>)
	).toString()

	try {
		const response = await fetch(`${API_BASE}/evaluation/requesttime/list?${queryString}`, {
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${authToken}`,
				'accept': 'application/json',
			}
		})

		if (!response.ok) {
			throw new Error(`Requests API failed: ${response.status} ${response.statusText}`)
		}

		const data: RequestResponse = await response.json()
		return data
	} catch (error) {
		console.error(`Request API failed for session ${sessionId}:`, error)
		throw error
	}
} 