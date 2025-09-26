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
		console.log('🔐 Making auth request to:', `${API_BASE}/auth/token/`)
		console.log('📤 Auth credentials:', credentials)
		
		const response = await fetch(`${API_BASE}/auth/token/`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(credentials)
		})

		console.log('📥 Auth response status:', response.status)
		console.log('📥 Auth response ok:', response.ok)

		if (!response.ok) {
			throw new Error(`Auth failed: ${response.status} ${response.statusText}`)
		}

		const data = await response.json()
		console.log('📥 Raw auth response:', data)
		console.log('📥 Response keys:', Object.keys(data))
		
		// Check if the response contains an error message
		if (data.message && !data.access && !data.token) {
			console.error('❌ Auth API returned message instead of token:', data.message)
			throw new Error(`Authentication failed: ${data.message}`)
		}
		
		// Try different possible field names for the token
		const token = data.access || data.token || data.access_token || data.accessToken
		
		if (!token) {
			console.error('❌ No access token found in response. Available fields:', Object.keys(data))
			console.error('❌ Full response:', JSON.stringify(data, null, 2))
			throw new Error(`No access token in response. Available fields: ${Object.keys(data).join(', ')}. Full response: ${JSON.stringify(data)}`)
		}

		console.log('✅ Found access token:', token.substring(0, 20) + '...')
		return token
	} catch (error) {
		console.error('❌ Auth token request failed:', error)
		throw error
	}
} 