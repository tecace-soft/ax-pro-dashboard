import { IconBell, IconMoon, IconUser, IconLogout } from '../ui/icons'
import { useNavigate } from 'react-router-dom'

interface HeaderProps {
  performanceScore: number
  performanceDate?: string
  currentTime: string
  onSignOut: () => void
}

export default function Header({ performanceScore, performanceDate, currentTime, onSignOut }: HeaderProps) {
  const navigate = useNavigate()
  
  const getPerformanceLabel = (score: number) => {
    if (score >= 90) return 'Excellent'
    if (score >= 80) return 'Good'
    if (score >= 70) return 'Fair'
    return 'Poor'
  }

  const handleLogoClick = () => {
    navigate('/dashboard')
  }

  return (
    <header className="dashboard-header">
      <div className="header-left">
        <div className="logo" onClick={handleLogoClick} style={{ cursor: 'pointer' }}>
          {/* 새로운 육각형 로고 */}
          <div className="logo-hexagon">
            <div className="hexagon-outer">
              <div className="hexagon-inner">
                {/* 'T' 글자 제거 */}
              </div>
            </div>
          </div>
          <span className="logo-text">TecAce Ax Pro</span>
        </div>
      </div>
      
      <div className="header-right">
        <div className="performance-indicator">
          <span className="performance-text">
            TecAce Ax Pro: {performanceScore}% ({getPerformanceLabel(performanceScore)}{performanceDate ? `, ${performanceDate}` : ''})
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