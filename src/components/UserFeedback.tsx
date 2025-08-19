import { useState, useEffect } from 'react'
import { fetchUserFeedback } from '../services/userFeedback'
import { UserFeedbackData } from '../services/supabase'

export default function UserFeedback() {
  const [userFeedbacks, setUserFeedbacks] = useState<UserFeedbackData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadUserFeedback()
  }, [])

  const loadUserFeedback = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const data = await fetchUserFeedback()
      setUserFeedbacks(data)
    } catch (error) {
      console.error('Failed to load user feedback:', error)
      setError('Failed to load user feedback')
    } finally {
      setIsLoading(false)
    }
  }

  const getReactionIcon = (reaction: string) => {
    // Handle various reaction formats
    const normalizedReaction = reaction.toLowerCase()
    
    if (normalizedReaction.includes('thumbs_up') || normalizedReaction.includes('like') || normalizedReaction === 'positive') {
      return (
        <div className="feedback-reaction thumbs-up">
          <svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 8h-5.612l1.123-3.367c.202-.608.1-1.282-.275-1.802S14.253 2 13.612 2H12c-.297 0-.578.132-.769.36L6.531 8H4c-1.103 0-2 .897-2 2v9c0 1.103.897 2 2 2h13.307a2.01 2.01 0 0 0 1.873-1.298l2.757-7.351A1 1 0 0 0 22 12v-2c0-1.103-.897-2-2-2zM4 10h2v9H4v-9zm16 1.819L17.307 19H8V9.362L12.468 4h1.146l-1.562 4.683A.998.998 0 0 0 13 10h7v1.819z"></path>
          </svg>
        </div>
      )
    } else {
      return (
        <div className="feedback-reaction thumbs-down">
          <svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 3H6.693A2.01 2.01 0 0 0 4.82 4.298l-2.757 7.351A1 1 0 0 0 2 12v2c0 1.103.897 2 2 2h5.612L8.49 19.367a2.004 2.004 0 0 0 .274 1.802c.376.52.982.831 1.624.831H12c.297 0 .578-.132.769-.360l4.7-5.64H20c1.103 0 2-.897 2-2V5c0-1.103-.897-2-2-2zm-8.469 17h-1.145l1.562-4.684A1 1 0 0 0 11 14H4v-1.819L6.693 5H16v9.638L11.531 20zM18 14V5h2l.001 9H18z"></path>
          </svg>
        </div>
      )
    }
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleString()
    } catch (error) {
      return 'Unknown date'
    }
  }

  return (
    <div className="user-feedback-container">
      <div className="user-feedback-header">
        <div className="user-feedback-title">User Feedback</div>
        <button 
          className="btn btn-ghost refresh-btn" 
          onClick={loadUserFeedback}
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
      
      <div className="user-feedback-content">
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
        {isLoading ? (
          <div className="loading-message">
            <p className="muted">Loading user feedback...</p>
          </div>
        ) : userFeedbacks.length === 0 ? (
          <div className="empty-message">
            <p className="muted">No user feedback found.</p>
          </div>
        ) : (
          <div className="feedback-list">
            {userFeedbacks.map((feedback) => (
              <div key={feedback.id} className="feedback-item">
                                 <div className="feedback-header">
                   <div className="feedback-meta">
                     <div className="feedback-user-name">{feedback.user_name}</div>
                     <div className="feedback-date">{formatDate(feedback.created_at || feedback.timestamp)}</div>
                   </div>
                   {getReactionIcon(feedback.reaction)}
                 </div>
                 
                 <div className="feedback-body">
                   {feedback.feedback_text && (
                     <div className="feedback-text">
                       <span className="feedback-label">Feedback:</span>
                       <span className="feedback-content">{feedback.feedback_text}</span>
                     </div>
                   )}
                   
                   {(feedback.chat_message || feedback.chat_response) && (
                     <div className="chat-conversation">
                       {feedback.chat_message && (
                         <div className="chat-row">
                           <span className="chat-label user">Message:</span>
                           <span className="chat-text">{feedback.chat_message}</span>
                         </div>
                       )}
                       {feedback.chat_response && (
                         <div className="chat-row">
                           <span className="chat-label ai">Response:</span>
                           <span className="chat-text">{feedback.chat_response}</span>
                         </div>
                       )}
                     </div>
                   )}
                 </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
} 