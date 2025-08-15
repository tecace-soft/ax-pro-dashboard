import { useState, useEffect, useRef } from 'react'
import { fetchSystemPrompt, updateSystemPrompt } from '../services/prompt'

export default function PromptControl() {
  const [promptText, setPromptText] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    async function loadSystemPrompt() {
      try {
        console.log('Attempting to fetch system prompt...')
        const content = await fetchSystemPrompt()
        console.log('System prompt received:', content)
        setPromptText(content)
      } catch (error) {
        console.error('Failed to load system prompt:', error)
        setPromptText('') // Keep empty on error
      } finally {
        setIsLoading(false)
      }
    }
    
    loadSystemPrompt()
  }, [])

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
            {isLoading ? 'Loading...' : isUpdating ? 'Updating...' : 'Update'}
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