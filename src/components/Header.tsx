import { IconBell, IconMoon, IconUser, IconLogout } from '../ui/icons'

interface HeaderProps {
  performanceScore: number
  currentTime: string
  onSignOut: () => void
}

export default function Header({ performanceScore, currentTime, onSignOut }: HeaderProps) {
  const getPerformanceLabel = (score: number) => {
    if (score >= 90) return 'Excellent'
    if (score >= 80) return 'Good'
    if (score >= 70) return 'Fair'
    return 'Poor'
  }

  return (
    <header className="dashboard-header">
      <div className="header-left">
        <div className="logo">
          <div className="logo-icon">TAP</div>
          <span className="logo-text">TecAce Ax Pro</span>
        </div>
      </div>
      
      <div className="header-right">
        <div className="performance-indicator">
          <span className="performance-text">
            TecAce Ax Pro: {performanceScore}% ({getPerformanceLabel(performanceScore)})
          </span>
          <span className="current-time">{currentTime}</span>
        </div>
        
        <div className="header-actions">
          <button className="icon-btn" aria-label="Notifications">
            <IconBell size={18} />
          </button>
          <button className="icon-btn" aria-label="Toggle theme">
            <IconMoon size={18} />
          </button>
          <button className="icon-btn" aria-label="User profile">
            <IconUser size={18} />
          </button>
          <button 
            className="icon-btn signout-btn" 
            aria-label="Sign out" 
            onClick={onSignOut}
            title="Sign Out"
          >
            <IconLogout size={18} />
          </button>
        </div>
      </div>
    </header>
  )
}