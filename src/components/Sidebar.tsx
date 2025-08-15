import { 
  IconSearch, 
  IconMessage, 
  IconHistory, 
  IconEdit, 
  IconDatabase, 
  IconMegaphone, 
  IconSettings,
  IconChevronRight,
  IconCamera,
  IconPalette,
  IconSave,
  IconX
} from '../ui/icons'
import { useState } from 'react'

interface SidebarProps {
  conversations: number
  satisfaction: number
  documents: number
  activeFilters: string[]
  onFilterChange: (filter: string) => void
  onSearch: (query: string) => void
  isCollapsed: boolean
  onToggleCollapse: () => void
}

export default function Sidebar({ 
  conversations, 
  satisfaction, 
  documents, 
  activeFilters, 
  onFilterChange, 
  onSearch,
  isCollapsed,
  onToggleCollapse
}: SidebarProps) {
  const [searchValue, setSearchValue] = useState('')
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [profileData, setProfileData] = useState({
    name: 'TecAce Ax Pro',
    role: 'Main AI Assistant for HR Support',
    performance: 85,
    avatar: 'AI'
  })
  
  const filters = [
    { key: 'all', label: 'All', count: documents },
    { key: 'policies', label: 'Policies', count: 45 },
    { key: 'benefits', label: 'Benefits', count: 32 },
    { key: 'training', label: 'Training', count: 28 },
    { key: 'payroll', label: 'Payroll', count: 21 }
  ]

  const recentSearches = [
    'HR policies',
    'Leave management', 
    'Performance reviews',
    'Benefits enrollment'
  ]

  const menuItems = [
    { icon: IconMessage, label: 'Dashboard', active: true },
    { icon: IconMessage, label: 'Monitoring' },
    { icon: IconMessage, label: 'Radar Chart' },
    { icon: IconHistory, label: 'Conversation History' },
    { icon: IconEdit, label: 'Edit Avatar' },
    { icon: IconDatabase, label: 'Knowledge Management' },
    { icon: IconMegaphone, label: 'Announcement' },
    { icon: IconSettings, label: 'Settings' }
  ]

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchValue(value)
    onSearch(value)
  }

  const handleFilterClick = (filterKey: string) => {
    onFilterChange(filterKey)
  }

  const handleRecentSearchClick = (searchTerm: string) => {
    setSearchValue(searchTerm)
    onSearch(searchTerm)
  }

  const handleProfileEdit = () => {
    setIsEditingProfile(true)
  }

  const handleProfileSave = () => {
    setIsEditingProfile(false)
    // 여기에 실제 저장 로직을 추가할 수 있습니다
  }

  const handleProfileCancel = () => {
    setIsEditingProfile(false)
    // 변경사항을 원래대로 되돌립니다
    setProfileData({
      name: 'TecAce Ax Pro',
      role: 'Main AI Assistant for HR Support',
      performance: 85,
      avatar: 'AI'
    })
  }

  const handleProfileChange = (field: string, value: string | number) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  return (
    <aside className={`dashboard-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-toggle" onClick={onToggleCollapse}>
        <IconChevronRight className={`toggle-icon ${isCollapsed ? 'rotated' : ''}`} />
      </div>
      
      {!isCollapsed && (
        <>
          {/* AI Assistant Profile */}
          <div className="ai-profile">
            <div className="profile-avatar">
              <div className="avatar-placeholder">{profileData.avatar}</div>
            </div>
            <div className="profile-info">
              {isEditingProfile ? (
                <div className="profile-edit-form">
                  <input
                    type="text"
                    className="profile-input"
                    value={profileData.name}
                    onChange={(e) => handleProfileChange('name', e.target.value)}
                    placeholder="AI Name"
                  />
                  <input
                    type="text"
                    className="profile-input"
                    value={profileData.role}
                    onChange={(e) => handleProfileChange('role', e.target.value)}
                    placeholder="Role Description"
                  />
                  <input
                    type="number"
                    className="profile-input"
                    value={profileData.performance}
                    onChange={(e) => handleProfileChange('performance', parseInt(e.target.value))}
                    placeholder="Performance %"
                    min="0"
                    max="100"
                  />
                  <input
                    type="text"
                    className="profile-input"
                    value={profileData.avatar}
                    onChange={(e) => handleProfileChange('avatar', e.target.value)}
                    placeholder="Avatar Text"
                    maxLength={3}
                  />
                </div>
              ) : (
                <>
                  <h3 className="profile-name">{profileData.name}</h3>
                  <p className="profile-role">{profileData.role}</p>
                  <div className="performance-score">
                    <span className="score">{profileData.performance}%</span>
                    <span className="label">Performance</span>
                  </div>
                  <div className="status-badge active">Active</div>
                </>
              )}
            </div>
            <div className="profile-actions">
              {isEditingProfile ? (
                <>
                  <button className="btn-small save-btn" onClick={handleProfileSave}>
                    <IconSave size={12} />
                    Save
                  </button>
                  <button className="btn-small cancel-btn" onClick={handleProfileCancel}>
                    <IconX size={12} />
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button className="btn-small" onClick={handleProfileEdit}>
                    <IconEdit size={12} />
                    Edit
                  </button>
                  <button className="btn-small">
                    <IconCamera size={12} />
                    Photo
                  </button>
                  <button className="btn-small">
                    <IconPalette size={12} />
                    Style
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="quick-stats">
            <div className="stat-item">
              <span className="stat-value">{conversations.toLocaleString()}</span>
              <span className="stat-label">Conversations</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{satisfaction}%</span>
              <span className="stat-label">Satisfaction</span>
            </div>
          </div>

          {/* Search */}
          <div className="search-section">
            <div className="search-input">
              <IconSearch size={16} />
              <input 
                type="text" 
                placeholder="Search knowledge base, conversat"
                value={searchValue}
                onChange={handleSearchChange}
              />
            </div>
          </div>

          {/* Filters */}
          <div className="filters-section">
            {filters.map(filter => (
              <button
                key={filter.key}
                className={`filter-btn ${activeFilters.includes(filter.key) ? 'active' : ''}`}
                onClick={() => handleFilterClick(filter.key)}
              >
                {filter.label} ({filter.count})
              </button>
            ))}
          </div>

          {/* Recent Searches */}
          <div className="recent-searches">
            <h4>Recent Searches</h4>
            <div className="search-tags">
              {recentSearches.map(search => (
                <button
                  key={search}
                  className="search-tag clickable"
                  onClick={() => handleRecentSearchClick(search)}
                >
                  {search}
                </button>
              ))}
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="sidebar-nav">
            {menuItems.map(item => (
              <button
                key={item.label}
                className={`nav-item ${item.active ? 'active' : ''}`}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </>
      )}
    </aside>
  )
}