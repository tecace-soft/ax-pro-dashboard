import { IconActivity, IconCalendar, IconFilter } from '../ui/icons'
import { useState, useEffect } from 'react'

interface PerformanceTimelineProps {
  sessions: any[]
  startDate: string
  endDate: string
}

export default function PerformanceTimeline({ sessions, startDate, endDate }: PerformanceTimelineProps) {
  const [selectedPeriod, setSelectedPeriod] = useState('custom')
  const [chartData, setChartData] = useState<Array<{ date: string; count: number; dateObj: Date }>>([])

  // 기간 옵션들
  const periodOptions = [
    { key: '3d', label: 'Last 3 Days' },
    { key: '7d', label: 'Last 7 Days' },
    { key: '14d', label: 'Last 14 Days' },
    { key: '30d', label: 'Last 30 Days' },
    { key: 'custom', label: 'Custom Range' }
  ]

  useEffect(() => {
    if (sessions && sessions.length > 0) {
      generateChartData()
    }
  }, [sessions, selectedPeriod])

  const generateChartData = () => {
    if (!sessions || sessions.length === 0) return

    const messagesByDate: Record<string, number> = {}
    
    // Recent Conversations의 실제 세션 데이터에서 메시지 개수 계산
    sessions.forEach(session => {
      if (session.createdAt) {
        // 날짜를 'MMM DD' 형식으로 변환
        const date = new Date(session.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        })
        
        if (!messagesByDate[date]) {
          messagesByDate[date] = 0
        }
        
        // 각 세션의 메시지 개수 (requestCount 또는 기본값 1)
        const messageCount = session.requestCount || 1
        messagesByDate[date] += messageCount
      }
    })

    // 날짜별로 정렬하고 차트 데이터 생성
    const sortedData = Object.entries(messagesByDate)
      .map(([date, count]) => ({
        date,
        count,
        dateObj: new Date(date)
      }))
      .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())

    setChartData(sortedData)
  }

  const totalMessages = chartData.reduce((sum, item) => sum + item.count, 0)
  const maxMessages = Math.max(...chartData.map(d => d.count), 1)
  const avgMessages = Math.round(totalMessages / Math.max(chartData.length, 1))

  // 디버깅을 위한 로그
  console.log('Chart Data:', chartData)
  console.log('Max Messages:', maxMessages)
  console.log('Total Messages:', totalMessages)

  return (
    <div className="performance-timeline">
      <div className="timeline-header">
        <h3>Daily Message Activity</h3>
        <div className="timeline-summary">
          <span className="summary-text">
            Total: {totalMessages} messages | Avg: {avgMessages}/day
          </span>
        </div>
      </div>

      <div className="timeline-controls">
        <div className="period-selector">
          {periodOptions.map(option => (
            <button
              key={option.key}
              className={`period-btn ${selectedPeriod === option.key ? 'active' : ''}`}
              onClick={() => setSelectedPeriod(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="timeline-chart">
        {chartData.length > 0 ? (
          <div className="chart-container">
            {/* Y-axis labels */}
            <div className="y-axis">
              {Array.from({ length: 6 }, (_, i) => {
                const value = Math.ceil(maxMessages * (1 - i / 5))
                return (
                  <div key={i} className="y-label">
                    {value}
                  </div>
                )
              })}
            </div>
            
            {/* Chart bars */}
            <div className="chart-bars">
              {chartData.map((item, index) => {
                // 바 높이 계산 수정
                const barHeight = maxMessages > 0 ? Math.max((item.count / maxMessages) * 100, 2) : 2
                console.log(`Bar ${index}: count=${item.count}, maxMessages=${maxMessages}, height=${barHeight}%`)
                
                return (
                  <div key={index} className="chart-bar-container">
                    <div 
                      className="chart-bar" 
                      style={{ 
                        height: `${barHeight}%`,
                        minHeight: '4px' // 최소 높이 보장
                      }}
                    >
                      <div className="bar-value">{item.count}</div>
                    </div>
                  </div>
                )
              })}
            </div>
            
            {/* X-axis labels - 각 막대 아래에 정확히 정렬 */}
            <div className="x-axis">
              {chartData.map((item, index) => (
                <div key={index} className="x-label">
                  {item.date}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="no-data">
            <IconActivity size={48} />
            <p>No message data available</p>
          </div>
        )}
      </div>
    </div>
  )
}

