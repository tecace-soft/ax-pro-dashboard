import { useState } from 'react'
import { IconTarget, IconClock, IconHeart, IconLightbulb, IconUsers, IconZap } from '../ui/icons'

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

  // 데이터 포인트 좌표 계산 - Y축 조정
  const getPointCoordinates = (index: number, total: number, value: number) => {
    const angle = (index * 360) / total - 90
    const radius = (value / 100) * maxRadius
    const x = Math.cos(angle * Math.PI / 180) * radius
    const y = Math.sin(angle * Math.PI / 180) * radius
    return { x, y: y + centerY - center, angle } // Y축 조정
  }

  // 레이블 위치 계산 - 균등한 거리로 조정
  const getLabelCoordinates = (index: number, total: number) => {
    const angle = (index * 360) / total - 90
    const labelRadius = maxRadius + 35 // 모든 레이블을 동일한 거리에
    const x = Math.cos(angle * Math.PI / 180) * labelRadius
    const y = Math.sin(angle * Math.PI / 180) * labelRadius + centerY - center // Y축 조정
    
    // 각도별 정확한 위치 조정 - 균등한 거리
    let textAlign = 'center'
    let offsetX = 0
    let offsetY = 0
    
    if (index === 0) { // Relevance (상단)
      textAlign = 'center'
      offsetX = -40
      offsetY = -20
    } else if (index === 1) { // Tone (우상단)
      textAlign = 'left'
      offsetX = 8
      offsetY = -15
    } else if (index === 2) { // Length (우하단)
      textAlign = 'left'
      offsetX = 8
      offsetY = 15
    } else if (index === 3) { // Accuracy (하단)
      textAlign = 'center'
      offsetX = -40
      offsetY = 20
    } else if (index === 4) { // Toxicity (좌하단)
      textAlign = 'right'
      offsetX = -88
      offsetY = 15
    } else { // Prompt injection (좌상단)
      textAlign = 'right'
      offsetX = -88
      offsetY = -15
    }
    
    return { x, y, angle, textAlign, offsetX, offsetY }
  }

  // SVG path 생성 - Y축 조정
  const createRadarPath = () => {
    if (activeDataPoints.length < 3) return ''
    
    const points = activeDataPoints.map((point, index) => {
      const coords = getPointCoordinates(index, activeDataPoints.length, point.value)
      return `${coords.x + center},${coords.y + center}`
    })
    
    return `M ${points.join(' L ')} Z`
  }

  return (
    <div className="performance-radar-container">
      <div className="radar-chart-section">
        <div className="radar-chart-large">
          <svg className="radar-svg-large" width={chartSize} height={chartSize}>
            {/* 배경 그리드 - Y축 조정 */}
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
            
            {/* 퍼센트 라벨 - Y축 조정 */}
            {[20, 40, 60, 80].map(percent => (
              <text
                key={percent}
                x={center + (percent / 100) * maxRadius + 8}
                y={centerY - 4}
                fill="rgba(255, 255, 255, 0.4)"
                fontSize="11"
                fontWeight="500"
              >
                {percent}%
              </text>
            ))}
            
            {/* 방사형 축 - Y축 조정 */}
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
            
            {/* 연결 폴리곤 */}
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

          {/* 중앙 점수 - Y축 조정 */}
          <div className="radar-center-large" style={{ top: `${centerY}px` }}>
            <span className="center-score-large">{averageScore}</span>
            <span className="center-label-large">OVERALL</span>
          </div>
          
          {/* 데이터 포인트와 점수 */}
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
          
          {/* 레이블 - 균등한 거리로 */}
          {activeDataPoints.map((point, index) => {
            const coords = getLabelCoordinates(index, activeDataPoints.length)
            
            return (
              <div
                key={`label-${point.key}`}
                className="radar-label-clean"
                style={{
                  transform: `translate(${coords.x + coords.offsetX}px, ${coords.y + coords.offsetY}px)`,
                  textAlign: coords.textAlign as any
                }}
              >
                {point.label}
              </div>
            )
          })}
        </div>
      </div>

      {/* Module Control */}
      <div className="module-control">
        <h3>Module Control</h3>
        <p className="control-subtitle">{activeCount} Active</p>
        
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
    </div>
  )
}