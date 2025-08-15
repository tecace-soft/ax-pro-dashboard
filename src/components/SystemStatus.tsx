import { IconShield, IconWifi, IconBrain } from '../ui/icons'

interface SystemStatusProps {
  coreSystems: number
  security: number
  network: number
}

export default function SystemStatus({ coreSystems, security, network }: SystemStatusProps) {
  const systems = [
    { name: 'Core Systems', value: coreSystems, icon: IconBrain, color: 'blue' },
    { name: 'Security', value: security, icon: IconShield, color: 'green' },
    { name: 'Network', value: network, icon: IconWifi, color: 'purple' }
  ]

  return (
    <div className="system-status">
      <h3>SYSTEM STATUS</h3>
      <div className="status-items">
        {systems.map(system => (
          <div key={system.name} className="status-item">
            <div className="status-header">
              <system.icon size={16} />
              <span className="status-name">{system.name}</span>
            </div>
            <div className="status-bar">
              <div 
                className={`status-progress ${system.color}`}
                style={{ width: `${system.value}%` }}
              ></div>
            </div>
            <div className="status-value">{system.value}%</div>
          </div>
        ))}
      </div>
    </div>
  )
}
