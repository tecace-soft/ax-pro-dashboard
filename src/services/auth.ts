const API_BASE = '/api'

interface TokenResponse {
	access: string
	refresh?: string
}

interface LoginCredentials {
	username: string
	password: string
}

export async function getAuthToken(): Promise<string> {
	const credentials: LoginCredentials = {
		username: 'tecacehq',
		password: 'qwe123!@#'
	}

	try {
		const response = await fetch(`${API_BASE}/auth/token/`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(credentials)
		})

		if (!response.ok) {
			throw new Error(`Auth failed: ${response.status} ${response.statusText}`)
		}

		const data: TokenResponse = await response.json()
		
		if (!data.access) {
			throw new Error('No access token in response')
		}


		return data.access
	} catch (error) {
		console.error('Auth token request failed:', error)
		throw error
	}
} 