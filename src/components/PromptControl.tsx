import { useState, useEffect, useRef } from 'react'
import { fetchSystemPrompt, updateSystemPrompt } from '../services/prompt'

export default function PromptControl() {
  const [promptText, setPromptText] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [forceReloadStatus, setForceReloadStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [lastResponse, setLastResponse] = useState<any>(null)

  useEffect(() => {
    async function loadSystemPrompt() {
      try {
        console.log('Attempting to fetch system prompt...')
        const content = await fetchSystemPrompt()
        console.log('System prompt received:', content)
        setPromptText(content)
        setLastRefreshed(new Date())
      } catch (error) {
        console.error('Failed to load system prompt:', error)
        setPromptText('') // Keep empty on error
      } finally {
        setIsLoading(false)
      }
    }
    
    loadSystemPrompt()
  }, [])

  // Auto-refresh when key changes (triggered by admin feedback submission)
  useEffect(() => {
    if (!isLoading) {
      handleRefresh()
    }
  }, []) // This will run when the component re-mounts due to key change

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      const content = await fetchSystemPrompt()
      setPromptText(content)
      setLastRefreshed(new Date())
    } catch (error) {
      console.error('Failed to refresh system prompt:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleUpdate = () => {
    setShowConfirmation(true)
  }

  const handleConfirmUpdate = async () => {
    setIsUpdating(true)
    setShowConfirmation(false)
    
    try {
      await updateSystemPrompt(promptText)
      // Success feedback could be added here
    } catch (error) {
      console.error('Failed to update system prompt:', error)
      // Error handling could be improved here
    } finally {
      setIsUpdating(false)
    }
  }

  const handleCancelUpdate = () => {
    setShowConfirmation(false)
  }

  const handleForceReload = async () => {
    console.log('🔄 Starting force prompt reload...')
    setForceReloadStatus('loading')
    
    try {
      const url = '/prompt-api/force-prompt-reload'
      console.log('📡 Making POST request to:', url)
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      console.log('📊 Response status:', response.status)
      console.log('📊 Response statusText:', response.statusText)
      console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()))
      
      if (!response.ok) {
        console.error('❌ HTTP error:', response.status, response.statusText)
        setForceReloadStatus('error')
        return
      }
      
      const responseText = await response.text()
      console.log('📄 Raw response text:', responseText)
      
      let data
      try {
        data = JSON.parse(responseText)
        console.log('📋 Parsed response data:', data)
      } catch (parseError) {
        console.error('❌ Failed to parse JSON response:', parseError)
        console.log('📄 Raw response that failed to parse:', responseText)
        setForceReloadStatus('error')
        return
      }
      
      console.log('🔍 Checking status field:', data.status)
      console.log('🔍 Status type:', typeof data.status)
      console.log('🔍 Expected status:', 'Complete prompt reload successful')
      console.log('🔍 Status match:', data.status === 'Complete prompt reload successful')
      
      // Store the response for debugging
      setLastResponse(data)
      
      if (data.status === 'Complete prompt reload successful') {
        console.log('✅ Force prompt reload successful!')
        setForceReloadStatus('success')
      } else {
        console.log('❌ Unexpected status:', data.status)
        console.log('📋 Full response data:', data)
        setForceReloadStatus('error')
      }
    } catch (error) {
      console.error('❌ Network or other error during force prompt reload:', error)
      console.error('❌ Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      setForceReloadStatus('error')
    }
  }



  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    const startY = e.clientY
    const startHeight = textareaRef.current?.offsetHeight || 200

    const handleMouseMove = (e: MouseEvent) => {
      if (!textareaRef.current) return
      const deltaY = e.clientY - startY
      const newHeight = Math.max(200, startHeight + deltaY)
      textareaRef.current.style.height = `${newHeight}px`
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <div className="prompt-control-container">
      <div className="prompt-header">
        <div className="prompt-title">Prompt Control</div>
        <div className="prompt-header-controls">
          <div className="last-refreshed">
            {lastRefreshed && (
              <span className="refresh-timestamp">
                Last refreshed: {lastRefreshed.toLocaleString()}
              </span>
            )}
          </div>
          <button 
            className="refresh-icon-btn"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh prompt from API"
          >
            {isRefreshing ? (
              <svg className="refresh-spinner" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25"/>
                <path d="M4.93 4.93A10 10 0 0 1 12 2a10 10 0 0 1 8.16 3.84" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                <path d="M21 3v5h-5"/>
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                <path d="M3 21v-5h5"/>
              </svg>
            )}
          </button>
        </div>
      </div>
      
      <div className="prompt-content">
        <div className="textarea-wrapper">
          <textarea
            ref={textareaRef}
            className="prompt-textarea"
            placeholder={isLoading ? "Loading system prompt..." : "Enter your prompt instructions here..."}
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            rows={8}
            disabled={isLoading}
          />
          <div 
            className="resize-handle"
            onMouseDown={handleMouseDown}
            style={{ cursor: isResizing ? 'ns-resize' : 'ns-resize' }}
          ></div>
        </div>
        
        <div className="prompt-actions">
          <button 
            className="btn btn-primary update-btn" 
            onClick={handleUpdate}
            disabled={isLoading || isUpdating}
          >
            {isLoading ? 'Loading...' : isUpdating ? 'Saving...' : 'Save'}
          </button>
          
          <div className="force-reload-section">
            <button 
              className="force-reload-link"
              onClick={handleForceReload}
              disabled={forceReloadStatus === 'loading'}
            >
              {forceReloadStatus === 'success' && <span className="status-icon success">✓</span>}
              {forceReloadStatus === 'error' && <span className="status-icon error">✗</span>}
              {forceReloadStatus === 'loading' ? 'Loading...' : 'Update chatbot system prompt to most recently saved version'}
            </button>
            {lastResponse && forceReloadStatus === 'error' && (
              <div className="debug-info">
                <small style={{color: '#ef4444', fontSize: '10px', display: 'block', marginTop: '4px'}}>
                  Debug: Status received: "{lastResponse.status}" | Expected: "Complete prompt reload successful"
                </small>
              </div>
            )}
          </div>
        </div>
      </div>

      {showConfirmation && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="confirmation-modal card">
            <div className="confirmation-content">
              <p>This will update the system prompt for HR AX Pro. Are you sure you would like to proceed?</p>
            </div>
            <button 
              className="btn btn-ghost confirmation-no-btn" 
              onClick={handleCancelUpdate}
            >
              No
            </button>
            <button 
              className="btn btn-primary confirmation-yes-btn" 
              onClick={handleConfirmUpdate}
            >
              Yes
            </button>
          </div>
        </div>
      )}
    </div>
  )
} 