interface PromptResponse {
  content: string
}

export async function fetchSystemPrompt(): Promise<string> {
  try {
    console.log('Making request to: /prompt-api/system-prompt')
    const response = await fetch('/prompt-api/system-prompt', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })

    console.log('Response status:', response.status)
    console.log('Response ok:', response.ok)

    if (!response.ok) {
      throw new Error(`System prompt API failed: ${response.status} ${response.statusText}`)
    }

    const data: PromptResponse = await response.json()
    console.log('Raw API response:', data)
    return data.content
  } catch (error) {
    console.error('System prompt API request failed:', error)
    throw error
  }
}

export async function updateSystemPrompt(content: string): Promise<void> {
  try {
    console.log('Updating system prompt with content:', content)
    const response = await fetch('/prompt-api/system-prompt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content })
    })

    console.log('Update response status:', response.status)
    console.log('Update response ok:', response.ok)

    if (!response.ok) {
      throw new Error(`System prompt update failed: ${response.status} ${response.statusText}`)
    }

    console.log('System prompt updated successfully')
  } catch (error) {
    console.error('System prompt update failed:', error)
    throw error
  }
} 