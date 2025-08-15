import { IconMessage } from '../ui/icons'

interface ConversationsBoxProps {
  sessions: any[]
  startDate: string
  endDate: string
  onStartDateChange: (date: string) => void
  onEndDateChange: (date: string) => void
}

export default function ConversationsBox({ 
  sessions, 
  startDate, 
  endDate, 
  onStartDateChange, 
  onEndDateChange 
}: ConversationsBoxProps) {
  return (
    <div className="conversations-box">
      <div className="box-header">
        <div className="box-title">
          <IconMessage size={20} />
          <h3>Recent Conversations</h3>
        </div>
        <div className="date-filters">
          <div className="date-input">
            <label>Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
            />
          </div>
          <div className="date-input">
            <label>End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="conversations-list">
        {sessions.map((session) => (
          <div key={session.id} className="conversation-item">
            <div className="conversation-info">
              <div className="session-id">Session: {session.id}</div>
              <div className="message-count">
                {session.requestCount || 1} message{session.requestCount !== 1 ? 's' : ''}
              </div>
            </div>
            <div className="conversation-date">
              <div className="date">
                {new Date(session.createdAt).toLocaleDateString('en-US', {
                  month: 'numeric',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </div>
              <div className="time">
                {new Date(session.createdAt).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
