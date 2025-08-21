import { useState } from 'react'
import { IconTarget, IconClock, IconHeart, IconLightbulb, IconUsers, IconZap } from '../ui/icons'
import '../styles/performance-radar.css'

interface PerformanceRadarProps {
  relevance: number
  tone: number
  length: number
  accuracy: number
  toxicity: number
  promptInjection: number
}

export default function PerformanceRadar({
  relevance,
  tone,
  length,
  accuracy,
  toxicity,
  promptInjection
}: PerformanceRadarProps) {
  
  const [toggles, setToggles] = useState({
    relevance: true,
    tone: true,
    length: true,
    accuracy: true,
    toxicity: true,
    promptInjection: true
  })

  // Module Control 접기/펼치기 상태 추가
  const [isModuleControlExpanded, setIsModuleControlExpanded] = useState(false)

  const allDataPoints = [
    { key: 'relevance', label: 'Relevance', value: relevance, description: 'Content Matching', icon: '⚡' },
    { key: 'tone', label: 'Tone', value: tone, description: 'Response Style', icon: '🎭' },
    { key: 'length', label: 'Length', value: length, description: 'Response Size', icon: '📏' },
    { key: 'accuracy', label: 'Accuracy', value: accuracy, description: 'Correct Answers', icon: '✓' },
    { key: 'toxicity', label: 'Toxicity', value: toxicity, description: 'Safety Check', icon: '🛡️' },
    { key: 'promptInjection', label: 'Prompt injection', value: promptInjection, description: 'Security Filter', icon: '🔒' }
  ]

  const activeDataPoints = allDataPoints.filter(point => toggles[point.key as keyof typeof toggles])
  
  const handleToggle = (key: string) => {
    setToggles(prev => ({
      ...prev,
      [key]: !prev[key as keyof typeof prev]
    }))
  }

  const activeCount = Object.values(toggles).filter(Boolean).length
  const averageScore = activeDataPoints.length > 0 
    ? Math.round(activeDataPoints.reduce((sum, point) => sum + point.value, 0) / activeDataPoints.length)
    : 0

  // 차트 크기와 중심점 - 위쪽으로 이동
  const chartSize = 400
  const center = chartSize / 2
  const centerY = center - 10 // 전체 차트를 위로 20px 이동
  const maxRadius = 130

  // 레이블 위치 계산 - 겹침 방지 및 정확한 정렬
  const getLabelCoordinates = (index: number, total: number) => {
    const angle = (index * 360) / total - 90
    const labelRadius = maxRadius + 42 // 레이블 거리 조정
    const x = Math.cos(angle * Math.PI / 180) * labelRadius
    const y = Math.sin(angle * Math.PI / 180) * labelRadius + centerY - center
    
    // 각도별 정확한 위치 조정 - 겹침 방지
    let textAlign = 'center'
    let offsetX = 0
    let offsetY = 0
    
    if (index === 0) { // Relevance (상단)
      textAlign = 'center'
      offsetX = -60
      offsetY = -30
    } else if (index === 1) { // Tone (우상단)
      textAlign = 'left'
      offsetX = 15
      offsetY = -25
    } else if (index === 2) { // Length (우하단)
      textAlign = 'left'
      offsetX = 15
      offsetY = 25
    } else if (index === 3) { // Accuracy (하단) - 겹침 방지
      textAlign = 'center'
      offsetX = -60
      offsetY = 20 // 아래로 너무 내려가지 않도록 조정
    } else if (index === 4) { // Toxicity (좌하단)
      textAlign = 'right'
      offsetX = -120
      offsetY = 20
    } else { // Prompt injection (좌상단)
      textAlign = 'right'
      offsetX = -120
      offsetY = -25
    }
    
    return { x, y, angle, textAlign, offsetX, offsetY }
  }

  // 데이터 포인트 좌표 계산 - 더 정확한 정렬
  const getPointCoordinates = (index: number, total: number, value: number) => {
    const angle = (index * 360) / total - 90
    const radius = (value / 100) * maxRadius
    const x = Math.cos(angle * Math.PI / 180) * radius
    const y = Math.sin(angle * Math.PI / 180) * radius
    return { x, y: y + centerY - center, angle }
  }

  // SVG path 생성 - 정확한 좌표 사용
  const createRadarPath = () => {
    if (activeDataPoints.length < 3) return ''
    
    const points = activeDataPoints.map((point, index) => {
      const coords = getPointCoordinates(index, activeDataPoints.length, point.value)
      return `${coords.x + center},${coords.y + center}`
    })
    
    return `M ${points.join(' L ')} Z`
  }

  return (
    <div className="performance-radar-section">
      <div className="radar-content-wrapper">
        {/* 타이틀과 설명 복원 - 번개 이모지 제거 */}
        <div className="radar-header">
          <h2 className="radar-title">Performance Radar</h2>
          <p className="radar-description">
            AI 응답 품질과 보안 성능을 6가지 핵심 지표로 실시간 모니터링하여 최적의 사용자 경험을 제공합니다
          </p>
        </div>
        
        <div className="radar-chart-section">
          <div className="radar-chart-large">
            <svg className="radar-svg-large" width={chartSize} height={chartSize}>
              {/* 배경 그리드 - 정확한 위치 */}
              {[20, 40, 60, 80, 100].map(percent => (
                <circle
                  key={percent}
                  cx={center}
                  cy={centerY}
                  r={(percent / 100) * maxRadius}
                  fill="none"
                  stroke="rgba(59, 230, 255, 0.15)"
                  strokeWidth="1"
                />
              ))}
              
              {/* 퍼센트 라벨 - 정확한 위치 */}
              {[20, 40, 60, 80].map(percent => (
                <text
                  key={percent}
                  x={center + (percent / 100) * maxRadius + 12}
                  y={centerY - 6}
                  fill="rgba(255, 255, 255, 0.4)"
                  fontSize="11"
                  fontWeight="500"
                  textAnchor="start"
                >
                  {percent}%
                </text>
              ))}
              
              {/* 방사형 축 - 정확한 위치 */}
              {activeDataPoints.map((_, index) => {
                const angle = (index * 360) / activeDataPoints.length - 90
                const x1 = center
                const y1 = centerY
                const x2 = x1 + Math.cos(angle * Math.PI / 180) * maxRadius
                const y2 = y1 + Math.sin(angle * Math.PI / 180) * maxRadius
                
                return (
                  <line
                    key={index}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="rgba(59, 230, 255, 0.2)"
                    strokeWidth="1"
                  />
                )
              })}
              
              {/* 연결 폴리곤 - 정확한 좌표 사용 */}
              {activeDataPoints.length >= 3 && (
                <path
                  d={createRadarPath()}
                  fill="rgba(59, 230, 255, 0.1)"
                  stroke="#3be6ff"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              )}
            </svg>

            {/* 중앙 점수 - 정확한 위치 */}
            <div className="radar-center-large" style={{ top: `${centerY}px` }}>
              <span className="center-score-large">{averageScore}</span>
              <span className="center-label-large">OVERALL</span>
            </div>
            
            {/* 데이터 포인트와 점수 - 정확한 위치 */}
            {activeDataPoints.map((point, index) => {
              const coords = getPointCoordinates(index, activeDataPoints.length, point.value)
              
              return (
                <div
                  key={`point-${point.key}`}
                  className="radar-point-large"
                  style={{
                    transform: `translate(${coords.x}px, ${coords.y}px)`
                  }}
                >
                  <div className="point-dot-large"></div>
                  <div className="point-score-box">
                    {point.value}
                  </div>
                </div>
              )
            })}
            
            {/* 레이블 - 정확한 위치 및 자동 폰트 크기 조정 */}
            {activeDataPoints.map((point, index) => {
              const coords = getLabelCoordinates(index, activeDataPoints.length)
              
              return (
                <div
                  key={`label-${point.key}`}
                  className={`radar-label-clean radar-label-${point.key}`}
                  style={{
                    transform: `translate(${coords.x + coords.offsetX}px, ${coords.y + coords.offsetY}px)`,
                    textAlign: coords.textAlign as any
                  }}
                >
                  <div className="label-content">
                    <span className="label-name">{point.label}</span>
                    <span className="label-score">{point.value}</span>
                  </div>
                </div>
              )
            })}
          </div>
          
          {/* Module Control - 겹침 방지를 위한 간격 조정 */}
          <div className="module-control-integrated">
            <div 
              className="module-control-header"
              onClick={() => setIsModuleControlExpanded(!isModuleControlExpanded)}
            >
              <div className="header-content">
                <span className="control-title">Module Control</span>
                <span className="control-badge">{activeCount} Active</span>
              </div>
              <div className={`expand-icon ${isModuleControlExpanded ? 'expanded' : ''}`}>
                ▼
              </div>
            </div>
            
            {isModuleControlExpanded && (
              <div className="module-control-content">
                <div className="control-list">
                  {allDataPoints.map((point) => (
                    <div key={point.key} className="control-item">
                      <div className="control-info">
                        <span className="control-icon">{point.icon}</span>
                        <div className="control-text">
                          <span className="control-label">{point.label}</span>
                          <span className="control-description">{point.description}</span>
                        </div>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={toggles[point.key as keyof typeof toggles]}
                          onChange={() => handleToggle(point.key)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}