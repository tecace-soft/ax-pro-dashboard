import { useState, useEffect, useRef } from 'react';
import { DailyRow, EstimationMode } from '../services/dailyAggregates';

interface PerformanceTimelineProps {
  data: DailyRow[];
  selectedDate: string;
  onDateChange: (date: string) => void;
  title?: string;
  includeSimulatedData: boolean;
  onIncludeSimulatedDataChange: (value: boolean) => void;
  estimationMode: EstimationMode;
  onEstimationModeChange: (mode: EstimationMode) => void;
}

export default function PerformanceTimeline({
  data,
  selectedDate,
  onDateChange,
  title = "Performance Timeline",
  includeSimulatedData,
  onIncludeSimulatedDataChange,
  estimationMode,
  onEstimationModeChange
}: PerformanceTimelineProps) {
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(800);
  const [showDataControls, setShowDataControls] = useState(false);
  const intervalRef = useRef<number | null>(null);

  // 자동 재생 기능
  useEffect(() => {
    if (isPlaying && data.length > 0) {
      const currentIndex = data.findIndex(item => item.Date === selectedDate);
      
      intervalRef.current = window.setInterval(() => {
        const nextIndex = (currentIndex + 1) % data.length;
        onDateChange(data[nextIndex].Date);
      }, playSpeed);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, selectedDate, data, playSpeed, onDateChange]);

  const handlePlayToggle = () => {
    setIsPlaying(!isPlaying);
  };

  // 전체 점수 계산
  const calculateOverallScore = (row: DailyRow) => {
    const metrics = [
      row.Toxicity,
      row['Prompt Injection'],
      row['Answer Correctness'],
      row['Answer Relevancy'],
      row.Length,
      row.Tone
    ];
    return Math.round(metrics.reduce((sum, val) => sum + val, 0) / metrics.length * 100);
  };

  const maxScore = Math.max(...data.map(calculateOverallScore), 100);
  const selectedRow = data.find(row => row.Date === selectedDate);

  if (data.length === 0) {
    return (
      <div className="performance-timeline">
        <div className="timeline-loading">Loading data...</div>
      </div>
    );
  }

  return (
    <div className="performance-timeline">
      {/* 한 줄 컨트롤 */}
      <div className="timeline-single-row">
        <div className="timeline-title-compact">
          <h3>{title}</h3>
        </div>
        
        <div className="timeline-controls-compact">
          {/* 날짜 선택 */}
          <div className="date-selector-compact">
            <label>Date:</label>
            <select 
              value={selectedDate} 
              onChange={(e) => onDateChange(e.target.value)}
              className="date-select-compact"
            >
              {data.map((row) => (
                <option key={row.Date} value={row.Date}>
                  {row.Date}
                  {row.isSimulated ? ' 📈' : ' 📊'}
                </option>
              ))}
            </select>
          </div>

          {/* 재생 컨트롤 */}
          <button 
            className={`play-btn-compact ${isPlaying ? 'playing' : ''}`}
            onClick={handlePlayToggle}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '⏸️' : '▶️'}
          </button>
          
          <select 
            value={playSpeed} 
            onChange={(e) => setPlaySpeed(Number(e.target.value))}
            className="speed-control-compact"
          >
            <option value={400}>Fast</option>
            <option value={800}>Normal</option>
            <option value={1200}>Slow</option>
          </select>

          {/* 데이터 표시 - 수정된 로직 */}
          <div className="data-indicator-compact">
            {selectedRow?.isSimulated ? (
              <span className="indicator estimated">📈 Estimated</span>
            ) : (
              <span className="indicator actual">📊 Actual</span>
            )}
          </div>

          {/* 설정 버튼 */}
          <div className="settings-container-compact">
            <button
              onClick={() => setShowDataControls(!showDataControls)}
              className={`settings-btn-compact ${showDataControls ? 'active' : ''}`}
              title="Settings"
            >
              ⚙️
            </button>

            {/* 설정 패널 */}
            {showDataControls && (
              <div className="settings-panel-compact">
                <div className="setting-item">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={includeSimulatedData}
                      onChange={(e) => onIncludeSimulatedDataChange(e.target.checked)}
                    />
                    <span>Include Estimated Data</span>
                  </label>
                </div>

                {includeSimulatedData && (
                  <div className="setting-item">
                    <label className="select-label">Estimation Mode:</label>
                    <select
                      value={estimationMode}
                      onChange={(e) => onEstimationModeChange(e.target.value as EstimationMode)}
                      className="mode-select"
                    >
                      <option value="simple">Simple (±5%)</option>
                      <option value="improved">Improved (±4% + pattern)</option>
                      <option value="realistic">Realistic (trend + weekly)</option>
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 차트 영역 */}
      <div className="timeline-chart">
        <div className="chart-container">
          {data.map((row, index) => {
            const score = calculateOverallScore(row);
            const height = (score / maxScore) * 100;
            const isSelected = row.Date === selectedDate;
            const isToday = row.Date === new Date().toISOString().slice(0, 10);
            
            // 클래스명 조합 개선
            let barClasses = ['bar'];
            
            // 데이터 타입 먼저 추가
            if (row.isSimulated) {
              barClasses.push('simulated');
            } else {
              barClasses.push('actual');
            }
            
            // 특별한 상태 추가 (우선순위: selected > today)
            if (isSelected) {
              barClasses.push('selected');
            } else if (isToday) {
              barClasses.push('today');
            }
            
            return (
              <div
                key={row.Date}
                className={barClasses.join(' ')}
                style={{ 
                  height: `${height}%`,
                  animationDelay: `${index * 50}ms`
                }}
                onClick={() => onDateChange(row.Date)}
                title={`${row.Date}: ${score}% ${row.isSimulated ? '(Estimated)' : '(Actual)'}`}
                onMouseEnter={(e) => {
                  console.log('Hovering:', row.Date); // 디버깅용
                }}
              >
                <span className="bar-value">{score}</span>
                
                {/* 임시로 호버 상태를 바로 표시해보기 */}
                <div style={{
                  position: 'absolute',
                  bottom: '-30px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(0,0,0,0.8)',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  whiteSpace: 'nowrap',
                  opacity: 0,
                  pointerEvents: 'none',
                  transition: 'opacity 0.2s'
                }}
                className="test-tooltip"
                >
                  {row.Date}: {score}%
                </div>
              </div>
            );
          })}
        </div>
        
        {/* X축 라벨 (시작/끝 날짜만) */}
        <div className="date-labels">
          <span className="date-start">{data[0]?.Date}</span>
          <span className="date-end">{data[data.length - 1]?.Date}</span>
        </div>
      </div>
    </div>
  );
}
