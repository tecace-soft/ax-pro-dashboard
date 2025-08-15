import { IconMessage, IconFileText, IconUsers } from '../ui/icons'

interface MetricsCardsProps {
  activeSessions: number
  documents: number
  openTickets: number
}

export default function MetricsCards({ activeSessions, documents, openTickets }: MetricsCardsProps) {
  const metrics = [
    {
      icon: IconMessage,
      label: 'Conversations',
      value: activeSessions,
      unit: 'Active sessions',
      color: 'blue'
    },
    {
      icon: IconFileText,
      label: 'Knowledge Base',
      value: documents,
      unit: 'Documents',
      color: 'green'
    },
    {
      icon: IconUsers,
      label: 'Support Tickets',
      value: openTickets,
      unit: 'Open tickets',
      color: 'purple'
    }
  ]

  return (
    <div className="metrics-cards">
      {metrics.map(metric => (
        <div key={metric.label} className={`metric-card ${metric.color}`}>
          <div className="metric-icon">
            <metric.icon size={24} />
          </div>
          <div className="metric-content">
            <div className="metric-value">{metric.value}</div>
            <div className="metric-label">{metric.label}</div>
            <div className="metric-unit">{metric.unit}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
