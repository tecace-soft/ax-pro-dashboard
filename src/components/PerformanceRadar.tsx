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

  // 데이터 포인트 좌표 계산 - 정확한 정렬을 위해 수정
  const getPointCoordinates = (index: number, total: number, value: number) => {
    const angle = (index * 360) / total - 90 // -90도로 시작하여 상단에서 시작
    const radius = (value / 100) * maxRadius
    const x = Math.cos(angle * Math.PI / 180) * radius
    const y = Math.sin(angle * Math.PI / 180) * radius
    return { x, y: y + centerY - center, angle }
  }

  // SVG path 생성 - 정확한 좌표 사용
  const createRadarPath = () => {
    if (activeDataPoints.length < 3) return ''
    
    const points = activeDataPoints.map((point, index) => {
      const coords = getPointCoordinates(index, 6, point.value)
      return `${coords.x + center},${coords.y + center}`
    })
    
    return `M ${points.join(' L ')} Z`
  }

  // 레이블 위치 계산 함수 수정
  const getLabelCoordinates = (index: number, total: number) => {
    const angle = (index * 360) / total - 90
    const labelRadius = maxRadius + 60 // 레이블 거리 증가
    
    // 레이더 센터를 기준으로 정확한 위치 계산
    const x = Math.cos(angle * Math.PI / 180) * labelRadius
    const y = Math.sin(angle * Math.PI / 180) * labelRadius
    
    // 각도별 텍스트 정렬 방향 결정
    let textAlign = 'center'
    
    if (index === 0) { // Relevance (상단)
      textAlign = 'center'
    } else if (index === 1) { // Tone (우상단)
      textAlign = 'left'
    } else if (index === 2) { // Length (우하단)
      textAlign = 'left'
    } else if (index === 3) { // Accuracy (하단)
      textAlign = 'center'
    } else if (index === 4) { // Toxicity (좌하단)
      textAlign = 'right'
    } else if (index === 5) { // Prompt Injection (좌상단)
      textAlign = 'right'
    }
    
    return { x, y, angle, textAlign }
  }

  return (
    <>
      <div className="performance-radar-section">
        <div className="radar-content-wrapper">
          {/* 타이틀과 설명 */}
          <div className="radar-header">
            <h2 className="radar-title">Performance Radar</h2>
            <p className="radar-description">
              AI 응답 품질과 보안 성능을 6가지 핵심 지표로 실시간 모니터링하여 최적의 사용자 경험을 제공합니다
            </p>
          </div>
          
          {/* 레이더 차트 */}
          <div className="radar-chart-section">
            <div className="radar-chart-large">
              <svg className="radar-svg-large" width={chartSize} height={chartSize}>
                {/* 배경 그리드 */}
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
                
                {/* 중심점에서 각 축으로의 라인 */}
                {[0, 1, 2, 3, 4, 5].map(index => {
                  const angle = (index * 360) / 6 - 90
                  const endX = Math.cos(angle * Math.PI / 180) * maxRadius
                  const endY = Math.sin(angle * Math.PI / 180) * maxRadius
                  return (
                    <line
                      key={index}
                      x1={center}
                      y1={centerY}
                      x2={center + endX}
                      y2={centerY + endY}
                      stroke="rgba(59, 230, 255, 0.2)"
                      strokeWidth="1"
                    />
                  )
                })}
                
                {/* 레이더 폴리곤 */}
                <path
                  d={createRadarPath()}
                  fill="rgba(59, 230, 255, 0.1)"
                  stroke="rgba(59, 230, 255, 0.8)"
                  strokeWidth="2"
                />
                
                {/* 데이터 포인트 */}
                {activeDataPoints.map((point, index) => {
                  const coords = getPointCoordinates(index, 6, point.value)
                  return (
                    <g key={index} className="radar-point-large">
                      <circle
                        className="point-dot-large"
                        cx={coords.x + center}
                        cy={coords.y + center}
                        r="6"
                        fill="#3be6ff"
                        stroke="white"
                        strokeWidth="2"
                      />
                      <text
                        x={coords.x + center}
                        y={coords.y + center - 15}
                        textAnchor="middle"
                        className="point-score-box"
                        fill="#3be6ff"
                        fontSize="12"
                        fontWeight="bold"
                      >
                        {point.value}
                      </text>
                    </g>
                  )
                })}
              </svg>
              
              {/* 중앙 점수 - 정확한 중앙 정렬 */}
              <div 
                className="radar-center-large"
                style={{
                  position: 'absolute',
                  top: `${centerY}px`,
                  left: `${center}px`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <div className="center-score-large">{averageScore}</div>
                <div className="center-label-large">OVERALL</div>
              </div>
            </div>
            
            {/* 레이블들 - 수정된 배치 */}
            {activeDataPoints.map((point, index) => {
              if (!point || !point.label) {
                return null;
              }
              
              const coords = getLabelCoordinates(index, 6)
              return (
                <div
                  key={index}
                  className={`radar-label-clean radar-label-${point.key.toLowerCase()}`}
                  // style 속성 완전 제거
                >
                  <div className="label-content">
                    <span className="label-name">{point.label}</span>
                    <span className="label-score">{point.value}</span>
                  </div>
                </div>
              )
            })}
          </div>
          
          {/* Module Control */}
          <div className="module-control-integrated">
            <div 
              className="module-control-header"
              onClick={() => setIsModuleControlExpanded(!isModuleControlExpanded)}
            >
              <div className="header-content">
                <span className="control-title">Module Control</span>
                <span className="control-badge">{activeCount} Active</span>
              </div>
              <span className={`expand-icon ${isModuleControlExpanded ? 'expanded' : ''}`}>
                ▼
              </span>
            </div>
            
            <div className={`module-control-content ${isModuleControlExpanded ? 'expanded' : ''}`}>
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
        </div>
      </div>
    </>
  )
}