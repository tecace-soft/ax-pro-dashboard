import { useState } from 'react'
import { IconZap, IconShield, IconBrain } from '../ui/icons'

export default function EnvironmentControls() {
  const [controls, setControls] = useState({
    aiProcessing: true,
    securityProtocol: true,
    autoLearning: true,
    maintenanceMode: false
  })

  const toggleControl = (key: string) => {
    setControls(prev => ({
      ...prev,
      [key]: !prev[key as keyof typeof prev]
    }))
  }

  const controlItems = [
    { key: 'aiProcessing', label: 'AI Processing', icon: IconZap },
    { key: 'securityProtocol', label: 'Security Protocol', icon: IconShield },
    { key: 'autoLearning', label: 'Auto Learning', icon: IconBrain },
    { key: 'maintenanceMode', label: 'Maintenance Mode', icon: IconBrain }
  ]

  return (
    <div className="environment-controls">
      <h3>ENVIRONMENT CONTROLS</h3>
      <div className="control-items">
        {controlItems.map(item => (
          <div key={item.key} className="control-item">
            <div className="control-info">
              <item.icon size={16} />
              <span className="control-label">{item.label}</span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={controls[item.key as keyof typeof controls]}
                onChange={() => toggleControl(item.key)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        ))}
      </div>
    </div>
  )
}
