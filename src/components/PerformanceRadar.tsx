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

  // Module Control 상태 관리 확인
  // 기본값을 collapsed로 설정
  const [isModuleControlExpanded, setIsModuleControlExpanded] = useState(false);

  // 토글 함수 수정
  const toggleModuleControl = () => {
    setIsModuleControlExpanded(prev => !prev);
    console.log('Module Control toggled:', !isModuleControlExpanded); // 디버깅용
  };

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

  // 포인트 수에 따른 동적 각도 계산
  const getPointCoordinates = (index: number, total: number, value: number) => {
    // 360도를 실제 포인트 수로 나누어 동적 각도 계산
    const angleStep = 360 / total;
    const angle = (index * angleStep) - 90; // -90도로 시작하여 상단에서 시작
    
    const radius = (value / 100) * maxRadius;
    const x = Math.cos(angle * Math.PI / 180) * radius;
    const y = Math.sin(angle * Math.PI / 180) * radius;
    
    return { x, y: y + centerY - center, angle }
  }

  // SVG path 생성 - 실제 포인트 수 적용
  const createRadarPath = () => {
    if (activeDataPoints.length < 3) return '';
    
    const points = activeDataPoints.map((point, index) => {
      // 실제 포인트 수 사용 (6이 아닌 activeDataPoints.length)
      const coords = getPointCoordinates(index, activeDataPoints.length, point.value);
      return `${coords.x + center},${coords.y + center}`
    })
    
    return `M ${points.join(' L ')} Z`
  }

  // 레이블 위치 계산 - 실제 포인트 수에 맞게 수정
  const getLabelCoordinates = (index: number, total: number) => {
    // 실제 포인트 수로 각도 계산
    const angleStep = 360 / total;
    const angle = (index * angleStep) - 90;
    const labelRadius = maxRadius + 60;
    
    const x = Math.cos(angle * Math.PI / 180) * labelRadius;
    const y = Math.sin(angle * Math.PI / 180) * labelRadius;
    
    // 각도에 따른 텍스트 정렬 동적 결정
    let textAlign = 'center';
    
    if (angle >= -45 && angle <= 45) { // 상단
      textAlign = 'center';
    } else if (angle > 45 && angle <= 135) { // 우측
      textAlign = 'left';
    } else if (angle > 135 || angle <= -135) { // 하단
      textAlign = 'center';
    } else { // 좌측
      textAlign = 'right';
    }
    
    // 레이블 위치 계산 시 디버깅 로그
    console.log(`Label ${index}: total=${total}, angle=${angle}, x=${x}, y=${y}`);
    
    return { x, y, angle, textAlign }
  }

  // 배경 그리드도 동적으로 생성
  const createBackgroundGrid = () => {
    const gridLines = [];
    
    // 원형 그리드
    for (let percent = 20; percent <= 100; percent += 20) {
      gridLines.push(
        <circle
          key={`circle-${percent}`}
          cx={center}
          cy={centerY}
          r={(percent / 100) * maxRadius}
          fill="none"
          stroke="rgba(59, 230, 255, 0.15)"
          strokeWidth="1"
        />
      );
    }
    
    // 방사형 라인 - 실제 포인트 수에 따라 동적 생성
    for (let i = 0; i < activeDataPoints.length; i++) {
      const angleStep = 360 / activeDataPoints.length;
      const angle = (i * angleStep) - 90;
      const endX = Math.cos(angle * Math.PI / 180) * maxRadius;
      const endY = Math.sin(angle * Math.PI / 180) * maxRadius;
      
      gridLines.push(
        <line
          key={`line-${i}`}
          x1={center}
          y1={centerY}
          x2={center + endX}
          y2={centerY + endY}
          stroke="rgba(59, 230, 255, 0.2)"
          strokeWidth="1"
        />
      );
    }
    
    return gridLines;
  }

  return (
    <>
      <div className="performance-radar-section">
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
              {/* 동적 배경 그리드 */}
              {createBackgroundGrid()}
              
              {/* 레이더 폴리곤 */}
              <path
                d={createRadarPath()}
                fill="rgba(59, 230, 255, 0.1)"
                stroke="rgba(59, 230, 255, 0.8)"
                strokeWidth="2"
              />
              
              {/* 데이터 포인트 - 실제 포인트 수 적용 */}
              {activeDataPoints.map((point, index) => {
                const coords = getPointCoordinates(index, activeDataPoints.length, point.value);
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
          
          {/* 레이블들 - 실제 포인트 수 적용 */}
          {activeDataPoints.map((point, index) => {
            if (!point || !point.label) {
              return null;
            }
            
            // 실제 포인트 수 사용 (6이 아닌 activeDataPoints.length)
            const coords = getLabelCoordinates(index, activeDataPoints.length);
            
            // 디버깅 로그
            console.log(`Rendering label ${index}: ${point.label}, x=${coords.x}, y=${coords.y}`);
            
            return (
              <div
                key={index}
                className={`radar-label-clean radar-label-${point.key.toLowerCase()}`}
                style={{
                  position: 'absolute',
                  left: `${center + coords.x}px`,
                  top: `${centerY + coords.y}px`,
                  transform: 'translate(-50%, -50%)', // 하나만 유지
                  textAlign: coords.textAlign as any,
                  zIndex: 10
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
        
        {/* Module Control */}
        <div className="module-control-integrated">
            {/* Module Control 헤더 부분 수정 */}
            <div 
              className="module-control-header"
              onClick={() => setIsModuleControlExpanded(!isModuleControlExpanded)}
            >
              <div className="header-content">
                <span className="control-title">Module Control</span>
                <span className="control-badge">{activeCount} Active</span>
              </div>
              <span className={`expand-icon ${isModuleControlExpanded ? 'expanded' : ''}`}>
                {isModuleControlExpanded ? '▼' : '▲'}
              </span>
            </div>

            {/* Module Control 내용 */}
            <div className={`module-control-content ${isModuleControlExpanded ? 'expanded' : 'collapsed'}`}>
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
    </>
  )
}