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
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')

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
    setSaveStatus('idle')
    
    try {
      // Step 1: Save the system prompt
      console.log('💾 Saving system prompt...')
      await updateSystemPrompt(promptText)
      console.log('✅ System prompt saved successfully')
      
      // Step 2: Force reload the chatbot with the new prompt
      console.log('🔄 Force reloading chatbot...')
      const response = await fetch('/prompt-api/force-prompt-reload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      console.log('📊 Force reload response status:', response.status)
      
      if (!response.ok) {
        console.error('❌ Force reload HTTP error:', response.status, response.statusText)
        setSaveStatus('error')
        return
      }
      
      const responseText = await response.text()
      console.log('📄 Force reload response text:', responseText)
      
      let data
      try {
        data = JSON.parse(responseText)
        console.log('📋 Force reload parsed data:', data)
      } catch (parseError) {
        console.error('❌ Failed to parse force reload JSON:', parseError)
        setSaveStatus('error')
        return
      }
      
      // Check if force reload was successful
      if (data.status === 'Complete prompt reload successful') {
        console.log('✅ Force reload successful!')
        setSaveStatus('success')
      } else {
        console.log('❌ Force reload failed with status:', data.status)
        setSaveStatus('error')
      }
      
    } catch (error) {
      console.error('❌ Save operation failed:', error)
      setSaveStatus('error')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleCancelUpdate = () => {
    setShowConfirmation(false)
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
            {saveStatus === 'success' && (
              <span className="status-icon success">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                </svg>
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="status-icon error">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
                </svg>
              </span>
            )}
            {isLoading ? 'Loading...' : isUpdating ? 'Saving...' : 'Save'}
          </button>
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