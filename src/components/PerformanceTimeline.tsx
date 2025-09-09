import { useState, useEffect, useRef } from 'react';
import { DailyRow } from '../services/dailyAggregates';

interface PerformanceTimelineProps {
  data: DailyRow[];
  selectedDate: string;
  onDateChange: (date: string) => void;
  title?: string;
  subtitle?: string;
}

export default function PerformanceTimeline({
  data,
  selectedDate,
  onDateChange,
  title = "Performance Timeline",
  subtitle = "시간별 추이"
}: PerformanceTimelineProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(800); // ms
  const intervalRef = useRef<number | null>(null);

  // 전체 점수 계산 (6개 메트릭의 평균)
  const calculateOverallScore = (row: DailyRow): number => {
    const scores = [
      row.Toxicity,
      row["Prompt Injection"],
      row["Answer Correctness"],
      row["Answer Relevancy"],
      row.Length,
      row.Tone
    ];
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    return Math.round(average * 100);
  };

  // 자동 재생 로직
  useEffect(() => {
    if (isPlaying && data.length > 0) {
      intervalRef.current = window.setInterval(() => {
        const currentIndex = data.findIndex(row => row.Date === selectedDate);
        const nextIndex = (currentIndex + 1) % data.length;
        onDateChange(data[nextIndex].Date);
        
        // 마지막 날짜에 도달하면 재생 중지
        if (nextIndex === 0) {
          setIsPlaying(false);
        }
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

  // 재생/일시정지 토글
  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      // 마지막 날짜에서 재생 시작하면 처음부터
      const currentIndex = data.findIndex(row => row.Date === selectedDate);
      if (currentIndex === data.length - 1) {
        onDateChange(data[0].Date);
      }
      setIsPlaying(true);
    }
  };

  // 처음으로 이동
  const goToFirst = () => {
    if (data.length > 0) {
      onDateChange(data[0].Date);
      setIsPlaying(false);
    }
  };

  // 마지막으로 이동
  const goToLast = () => {
    if (data.length > 0) {
      onDateChange(data[data.length - 1].Date);
      setIsPlaying(false);
    }
  };

  // 오늘 날짜
  const today = new Date().toISOString().split('T')[0];

  // 최대값 계산 (차트 스케일링용)
  const maxScore = Math.max(...data.map(calculateOverallScore));
  const chartHeight = 120;

  return (
    <div className="performance-timeline-section">
      {/* 헤더 */}
      <div className="timeline-header">
        <h3 className="timeline-title">{title}</h3>
        <p className="timeline-subtitle">{subtitle}</p>
      </div>

      {/* 컨트롤 패널 */}
      <div className="timeline-controls">
        <div className="playback-controls">
          <button 
            className="control-btn" 
            onClick={goToFirst}
            title="처음으로"
          >
            ⏮️
          </button>
          <button 
            className="control-btn play-btn" 
            onClick={togglePlay}
            title={isPlaying ? "일시정지" : "재생"}
          >
            {isPlaying ? '⏸️' : '▶️'}
          </button>
          <button 
            className="control-btn" 
            onClick={goToLast}
            title="마지막으로"
          >
            ⏭️
          </button>
        </div>

        <div className="speed-control">
          <label>Speed:</label>
          <select 
            value={playSpeed} 
            onChange={(e) => setPlaySpeed(Number(e.target.value))}
            disabled={isPlaying}
          >
            <option value={1200}>느리게</option>
            <option value={800}>보통</option>
            <option value={400}>빠르게</option>
            <option value={200}>매우 빠르게</option>
          </select>
        </div>

        <div className="date-info">
          선택된 날짜: <span className="selected-date">{selectedDate}</span>
        </div>
      </div>

      {/* 바 차트 */}
      <div className="timeline-chart">
        <div className="chart-container">
          <div className="y-axis">
            <span className="y-label">100%</span>
            <span className="y-label">50%</span>
            <span className="y-label">0%</span>
          </div>
          
          <div className="bars-container">
            {data.map((row, index) => {
              const score = calculateOverallScore(row);
              const height = (score / 100) * chartHeight;
              const isSelected = row.Date === selectedDate;
              const isToday = row.Date === today;
              const isEstimated = row.isSimulated;
              
              return (
                <div 
                  key={row.Date} 
                  className="bar-wrapper"
                  onClick={() => {
                    onDateChange(row.Date);
                    setIsPlaying(false);
                  }}
                >
                  <div 
                    className={`bar ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${isEstimated ? 'estimated' : 'actual'}`}
                    style={{ height: `${height}px` }}
                    title={`${row.Date}: ${score}% ${isEstimated ? '(Estimated)' : '(Actual)'}`}
                  >
                    <span className="bar-value">{score}</span>
                  </div>
                  <span className="bar-date">{row.Date.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 범례 */}
      <div className="timeline-legend">
        <div className="legend-item">
          <div className="legend-color actual"></div>
          <span>📊 Actual</span>
        </div>
        <div className="legend-item">
          <div className="legend-color estimated"></div>
          <span>📈 Estimated</span>
        </div>
        <div className="legend-item">
          <div className="legend-color today"></div>
          <span>🟡 Today</span>
        </div>
        <div className="legend-item">
          <div className="legend-color selected"></div>
          <span>🔵 Selected</span>
        </div>
      </div>
    </div>
  );
}
