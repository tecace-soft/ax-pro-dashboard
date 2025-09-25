import { IconCheck, IconX, IconAlertTriangle } from '../ui/icons'

type SyncStatus = 'synced' | 'orphaned' | 'needs_indexing' | 'unknown'

interface SyncBadgeProps {
  status: SyncStatus
  onClick?: () => void
  disabled?: boolean
}

export default function SyncBadge({ status, onClick, disabled }: SyncBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'synced':
        return {
          icon: <IconCheck className="sync-icon synced" />,
          label: 'Synced',
          className: 'sync-badge synced'
        }
      case 'orphaned':
        return {
          icon: <IconX className="sync-icon orphaned" />,
          label: 'Orphaned',
          className: 'sync-badge orphaned'
        }
      case 'needs_indexing':
        return {
          icon: <IconAlertTriangle className="sync-icon needs-indexing" />,
          label: 'Needs Indexing',
          className: 'sync-badge needs-indexing'
        }
      default:
        return {
          icon: <span className="sync-icon unknown">—</span>,
          label: 'Unknown',
          className: 'sync-badge unknown'
        }
    }
  }

  const config = getStatusConfig()

  return (
    <span 
      className={`${config.className} ${onClick ? 'clickable' : ''} ${disabled ? 'disabled' : ''}`}
      title={config.label}
      onClick={onClick}
    >
      {config.icon}
      <span className="sr-only">{config.label}</span>
    </span>
  )
}
