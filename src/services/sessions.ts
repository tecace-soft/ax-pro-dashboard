const API_BASE = '/api'

interface SessionParams {
	endDate: string
	page: number
	pageSize: number
	startDate: string
	timeUnit: string
	passed?: string
	validationKeyId?: number
	validationType?: string
}

interface Session {
	sessionId: string
	date: string
	// Add other fields as they come from the API
	[key: string]: any
}

interface SessionResponse {
	sessions: Session[]
	meta: {
		startDate: string
		endDate: string
		period: number
		timeUnit: string
		pagination: any
	}
}

export async function fetchSessions(
	authToken: string,
	startDate: string,
	endDate: string
): Promise<SessionResponse> {
	const params: SessionParams = {
		endDate,
		page: 1,
		pageSize: 20,
		startDate,
		timeUnit: 'day',
		passed: '',
		validationKeyId: 4,
		validationType: ''
	}

	const queryString = new URLSearchParams(
		Object.entries(params).reduce((acc, [key, value]) => {
			acc[key] = String(value)
			return acc
		}, {} as Record<string, string>)
	).toString()

	try {
		const response = await fetch(`${API_BASE}/evaluation/sessiontime/list?${queryString}`, {
			method: 'GET',
			headers: {
				'Authorization': `Bearer ${authToken}`,
				'accept': 'application/json',
			}
		})

		if (!response.ok) {
			throw new Error(`Sessions API failed: ${response.status} ${response.statusText}`)
		}

		const data: SessionResponse = await response.json()
		return data
	} catch (error) {
		console.error('Sessions API request failed:', error)
		throw error
	}
} 