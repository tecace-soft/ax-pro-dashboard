import { useState } from 'react'
import { getAuthToken } from '../services/auth'
import { fetchSessions } from '../services/sessions'
import { getAllAdminFeedback } from '../services/adminFeedback'
import { fetchSystemPrompt } from '../services/prompt'

export default function ApiTest() {
  const [results, setResults] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})

  const testEndpoint = async (name: string, testFn: () => Promise<any>) => {
    setLoading(prev => ({ ...prev, [name]: true }))
    try {
      const result = await testFn()
      setResults(prev => ({ ...prev, [name]: { success: true, data: result } }))
      console.log(`✅ ${name} success:`, result)
    } catch (error) {
      setResults(prev => ({ ...prev, [name]: { success: false, error: error instanceof Error ? error.message : String(error) } }))
      console.error(`❌ ${name} failed:`, error)
    } finally {
      setLoading(prev => ({ ...prev, [name]: false }))
    }
  }

  const testAuth = () => testEndpoint('Auth Token', getAuthToken)
  
  const testSessions = () => testEndpoint('Sessions', async () => {
    const token = await getAuthToken()
    const today = new Date()
    const start = new Date()
    start.setDate(today.getDate() - 7)
    const formatDate = (d: Date) => d.toISOString().split('T')[0]
    return fetchSessions(token, formatDate(start), formatDate(today))
  })

  const testAdminFeedback = () => testEndpoint('Admin Feedback', getAllAdminFeedback)
  
  const testPrompt = () => testEndpoint('System Prompt', fetchSystemPrompt)

  const testAll = async () => {
    await testAuth()
    await testSessions()
    await testAdminFeedback()
    await testPrompt()
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h2>API Endpoint Test</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <button onClick={testAll} disabled={Object.values(loading).some(Boolean)}>
          Test All Endpoints
        </button>
        <button onClick={testAuth} disabled={loading.auth}>
          Test Auth (/api)
        </button>
        <button onClick={testSessions} disabled={loading.sessions}>
          Test Sessions (/api)
        </button>
        <button onClick={testAdminFeedback} disabled={loading.adminFeedback}>
          Test Admin Feedback (Supabase)
        </button>
        <button onClick={testPrompt} disabled={loading.prompt}>
          Test Prompt (/prompt-api)
        </button>
      </div>

      <div>
        {Object.entries(results).map(([name, result]) => (
          <div key={name} style={{ 
            marginBottom: '10px', 
            padding: '10px', 
            border: '1px solid #ccc',
            backgroundColor: result.success ? '#d4edda' : '#f8d7da'
          }}>
            <h4>{name}: {result.success ? '✅ SUCCESS' : '❌ FAILED'}</h4>
            {result.success ? (
              <pre style={{ fontSize: '12px', overflow: 'auto', maxHeight: '200px' }}>
                {JSON.stringify(result.data, null, 2)}
              </pre>
            ) : (
              <div style={{ color: 'red' }}>
                Error: {result.error}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
