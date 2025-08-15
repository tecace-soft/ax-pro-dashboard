import { useState } from 'react'
import { IconTarget, IconClock, IconHeart, IconLightbulb, IconUsers, IconZap } from '../ui/icons'

interface PerformanceRadarProps {
  expertise: number
  accuracy: number
  efficiency: number
  helpfulness: number
  clarity: number
}

export default function PerformanceRadar({ 
  expertise, 
  accuracy, 
  efficiency, 
  helpfulness, 
  clarity 
}: PerformanceRadarProps) {
  const [activeModules, setActiveModules] = useState({
    expertise: true,
    accuracy: true,
    efficiency: true,
    politeness: true,
    helpfulness: true,
    clarity: true
  })

  // 더 균형잡힌 가짜 데이터로 변경
  const enhancedData = {
    expertise: 85,
    accuracy: 92,
    efficiency: 78,
    politeness: 88,
    helpfulness: 90,
    clarity: 82
  }

  const overall = Math.round((enhancedData.expertise + enhancedData.accuracy + enhancedData.efficiency + enhancedData.helpfulness + enhancedData.clarity) / 5)

  const modules = [
    { key: 'expertise', label: 'Expertise', sublabel: 'Domain Knowledge', value: enhancedData.expertise, icon: IconTarget },
    { key: 'accuracy', label: 'Accuracy', sublabel: 'Correct Answers', value: enhancedData.accuracy, icon: IconZap },
    { key: 'efficiency', label: 'Efficiency', sublabel: 'Response Time', value: enhancedData.efficiency, icon: IconClock },
    { key: 'politeness', label: 'Politeness', sublabel: 'User Satisfaction', value: enhancedData.politeness, icon: IconHeart },
    { key: 'helpfulness', label: 'Helpfulness', sublabel: 'Issue Resolution', value: enhancedData.helpfulness, icon: IconUsers },
    { key: 'clarity', label: 'Clarity', sublabel: 'Understanding Rate', value: enhancedData.clarity, icon: IconLightbulb }
  ]

  const toggleModule = (key: string) => {
    setActiveModules(prev => ({
      ...prev,
      [key]: !prev[key as keyof typeof prev]
    }))
  }

  return (
    <div className="performance-radar-section">
      <div className="radar-container">
        <div className="radar-chart">
          <div className="radar-hexagon">
            <div className="radar-center">
              <div className="overall-score">{overall}</div>
              <div className="overall-label">OVERALL</div>
            </div>
            <div className="radar-rings">
              <div className="ring ring-20"></div>
              <div className="ring ring-40"></div>
              <div className="ring ring-60"></div>
              <div className="ring ring-80"></div>
              <div className="ring ring-100"></div>
            </div>
            <div className="radar-metrics">
              {modules.map((module, index) => {
                const angle = (index * 60) - 90 // -90도부터 시작해서 위쪽부터
                const radius = 160 // 반지름
                const x = Math.cos(angle * Math.PI / 180) * radius * (module.value / 100)
                const y = Math.sin(angle * Math.PI / 180) * radius * (module.value / 100)
                
                return (
                  <div 
                    key={module.key}
                    className={`radar-metric ${activeModules[module.key as keyof typeof activeModules] ? 'active' : 'inactive'}`}
                  >
                    <div 
                      className="metric-point"
                      style={{
                        left: `calc(50% + ${x}px)`,
                        top: `calc(50% + ${y}px)`
                      }}
                    ></div>
                    <div 
                      className="metric-label"
                      style={{
                        left: `calc(50% + ${Math.cos(angle * Math.PI / 180) * 200}px)`,
                        top: `calc(50% + ${Math.sin(angle * Math.PI / 180) * 200}px)`
                      }}
                    >
                      {module.label}
                    </div>
                    <div 
                      className="metric-value"
                      style={{
                        left: `calc(50% + ${Math.cos(angle * Math.PI / 180) * 180}px)`,
                        top: `calc(50% + ${Math.sin(angle * Math.PI / 180) * 180}px)`
                      }}
                    >
                      {module.value}%
                    </div>
                  </div>
                )
              })}
            </div>
            
            {/* 레이더 차트 영역 표시 */}
            <svg className="radar-area" width="400" height="400" viewBox="0 0 400 400">
              <polygon
                points={modules.map((module, index) => {
                  const angle = (index * 60) - 90
                  const radius = 160 * (module.value / 100)
                  const x = 200 + Math.cos(angle * Math.PI / 180) * radius
                  const y = 200 + Math.sin(angle * Math.PI / 180) * radius
                  return `${x},${y}`
                }).join(' ')}
                fill="rgba(59,230,255,0.1)"
                stroke="rgba(59,230,255,0.3)"
                strokeWidth="2"
              />
            </svg>
          </div>
        </div>
      </div>

      <div className="module-controls">
        <h4>Module Control</h4>
        <div className="active-count">{Object.values(activeModules).filter(Boolean).length} Active</div>
        
        <div className="module-toggles">
          {modules.map(module => (
            <div key={module.key} className="module-toggle">
              <div className="toggle-info">
                <module.icon size={16} />
                <div>
                  <div className="toggle-label">{module.label}</div>
                  <div className="toggle-sublabel">{module.sublabel}</div>
                </div>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={activeModules[module.key as keyof typeof activeModules]}
                  onChange={() => toggleModule(module.key)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          ))}
        </div>

        <div className="performance-summary">
          <div className="summary-item">
            <span className="summary-label">평균 점수</span>
            <span className="summary-value">{overall}%</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">활성 모듈</span>
            <span className="summary-value">{Object.values(activeModules).filter(Boolean).length}개</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">분석 기간</span>
            <span className="summary-value">1개월</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Core 모듈</span>
            <span className="summary-value">6/6</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Advanced 모듈</span>
            <span className="summary-value">0/2</span>
          </div>
        </div>
      </div>
    </div>
  )
}