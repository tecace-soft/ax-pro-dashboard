import { useState, useEffect, useRef } from 'react';
import { DailyRow, EstimationMode } from '../services/dailyAggregates';

interface PerformanceTimelineProps {
  data: DailyRow[];
  selectedDate: string;
  onDateChange: (date: string) => void;
  title?: string;
  subtitle?: string;
  // 설정 관련 props 추가
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
  subtitle = "시간별 추이",
  includeSimulatedData,
  onIncludeSimulatedDataChange,
  estimationMode,
  onEstimationModeChange
}: PerformanceTimelineProps) {
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(800); // ms
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
        intervalRef.current = null;
      }
    };
  }, [isPlaying, selectedDate, data, onDateChange, playSpeed]);

  const handlePlayToggle = () => {
    setIsPlaying(!isPlaying);
  };

  // 전체 스코어 계산 (6개 메트릭 평균)
  const calculateOverallScore = (row: DailyRow): number => {
    const metrics = [
      row.Toxicity,
      row["Prompt Injection"],
      row["Answer Correctness"],
      row["Answer Relevancy"],
      row.Length,
      row.Tone
    ];
    return Math.round(metrics.reduce((sum, val) => sum + val, 0) / metrics.length * 100);
  };

  // 최대값 계산 (스케일링용)
  const maxScore = Math.max(...data.map(calculateOverallScore), 100);

  // 현재 선택된 행 데이터
  const selectedRow = data.find(row => row.Date === selectedDate);

  if (data.length === 0) {
    return (
      <div className="performance-timeline">
        <div className="timeline-header">
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <div className="timeline-loading">데이터를 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="performance-timeline">
      <div className="timeline-header">
        <div className="timeline-title">
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        
        <div className="timeline-controls">
          <button 
            className={`play-btn ${isPlaying ? 'playing' : ''}`}
            onClick={handlePlayToggle}
            title={isPlaying ? '일시정지' : '자동 재생'}
          >
            {isPlaying ? '⏸️' : '▶️'}
          </button>
          
          <select 
            value={playSpeed} 
            onChange={(e) => setPlaySpeed(Number(e.target.value))}
            className="speed-control"
          >
            <option value={400}>빠름</option>
            <option value={800}>보통</option>
            <option value={1200}>느림</option>
          </select>

          {/* 설정 버튼 추가 */}
          <div className="settings-container">
            <button
              onClick={() => setShowDataControls(!showDataControls)}
              className={`settings-btn ${showDataControls ? 'active' : ''}`}
              title="데이터 설정"
            >
              ⚙️
            </button>

            {/* 설정 패널 */}
            {showDataControls && (
              <div className="settings-panel">
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

      {/* 날짜 선택 섹션 */}
      <div className="date-selector-section">
        <div className="date-selector">
          <label>Date:</label>
          <select 
            value={selectedDate} 
            onChange={(e) => onDateChange(e.target.value)}
            className="date-control"
          >
            {data.map((row) => (
              <option key={row.Date} value={row.Date}>
                {row.Date} {row.isSimulated ? '📈' : '📊'}
              </option>
            ))}
          </select>
        </div>

        {/* 데이터 타입 인디케이터 */}
        {selectedRow && (
          <div className="data-type-indicator">
            <span className={`indicator ${selectedRow.isSimulated ? 'estimated' : 'actual'}`}>
              {selectedRow.isSimulated ? '📈 Estimated' : '📊 Actual'}
            </span>
          </div>
        )}
      </div>

      <div className="timeline-chart">
        <div className="chart-container">
          {data.map((row, index) => {
            const score = calculateOverallScore(row);
            const height = (score / maxScore) * 100;
            const isSelected = row.Date === selectedDate;
            const isToday = row.Date === new Date().toISOString().split('T')[0];
            
            return (
              <div 
                key={row.Date}
                className={`timeline-bar ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                style={{ height: `${height}%` }}
                onClick={() => onDateChange(row.Date)}
                title={`${row.Date}: ${score}점`}
              >
                <div className="bar-value">{score}</div>
                {row.isSimulated && <div className="simulated-indicator">📈</div>}
              </div>
            );
          })}
        </div>
        
        {/* 시작일과 마지막일 표시 */}
        <div className="date-labels">
          <div className="start-date">{data[0]?.Date}</div>
          <div className="end-date">{data[data.length - 1]?.Date}</div>
        </div>
        
        <div className="timeline-info">
          <div className="selected-date">
            선택된 날짜: <strong>{selectedDate}</strong>
            {data.find(d => d.Date === selectedDate)?.isSimulated && 
              <span className="estimated-badge">📈 Estimated</span>
            }
          </div>
          <div className="timeline-stats">
            총 {data.length}일 | 실제 데이터: {data.filter(d => !d.isSimulated).length}개
          </div>
        </div>
      </div>
    </div>
  );
}
