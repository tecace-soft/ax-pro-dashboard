import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { fetchSystemPrompt, updateSystemPrompt } from '../services/prompt'
import { fetchSystemPromptN8N, saveSystemPromptN8N } from '../services/promptN8N'

export default function PromptControl() {
  const location = useLocation()
  const isN8NRoute = location.pathname === '/dashboard-n8n' || location.pathname === '/rag-n8n'
  const [promptText, setPromptText] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [responseModal, setResponseModal] = useState<{
    isOpen: boolean
    message: string
    isSuccess: boolean
  }>({
    isOpen: false,
    message: '',
    isSuccess: false
  })

  useEffect(() => {
    async function loadSystemPrompt() {
      try {
        console.log('Attempting to fetch system prompt...', isN8NRoute ? '(N8N)' : '(Standard)')
        const content = isN8NRoute 
          ? await fetchSystemPromptN8N()
          : await fetchSystemPrompt()
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
  }, [isN8NRoute])

  // Auto-refresh when key changes (triggered by admin feedback submission)
  useEffect(() => {
    if (!isLoading) {
      handleRefresh()
    }
  }, []) // This will run when the component re-mounts due to key change

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      const content = isN8NRoute
        ? await fetchSystemPromptN8N()
        : await fetchSystemPrompt()
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
      if (isN8NRoute) {
        // N8N route: Save to Supabase
        console.log('💾 Saving system prompt to N8N Supabase...')
        await saveSystemPromptN8N(promptText)
        console.log('✅ N8N system prompt saved successfully')
        
        setResponseModal({
          isOpen: true,
          message: 'Prompt saved successfully to Supabase',
          isSuccess: true
        })
      } else {
        // Standard route: Use existing API flow
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
          setResponseModal({
            isOpen: true,
            message: `HTTP Error: ${response.status} ${response.statusText}`,
            isSuccess: false
          })
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
          setResponseModal({
            isOpen: true,
            message: 'Failed to parse server response',
            isSuccess: false
          })
          return
        }
        
        // Show the response message in modal
        setResponseModal({
          isOpen: true,
          message: data.message || 'No message received',
          isSuccess: data.status === 'Complete prompt reload successful'
        })
      }
      
    } catch (error) {
      console.error('❌ Save operation failed:', error)
      setResponseModal({
        isOpen: true,
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        isSuccess: false
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleCancelUpdate = () => {
    setShowConfirmation(false)
  }

  const handleCloseResponseModal = () => {
    setResponseModal({
      isOpen: false,
      message: '',
      isSuccess: false
    })
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
            title={isN8NRoute ? "Refresh prompt from Supabase" : "Refresh prompt from API"}
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
        </div>
      </div>

      {showConfirmation && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="confirmation-modal card">
            <div className="confirmation-content">
              <p>
                {isN8NRoute 
                  ? 'This will save a new prompt entry to Supabase. Are you sure you would like to proceed?'
                  : 'This will update the system prompt for HR AX Pro. Are you sure you would like to proceed?'}
              </p>
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

      {responseModal.isOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="confirmation-modal card">
            <div className="confirmation-content">
              <p>{responseModal.message}</p>
            </div>
            <button 
              className="btn btn-primary confirmation-yes-btn" 
              onClick={handleCloseResponseModal}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
} 