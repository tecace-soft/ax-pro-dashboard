// src/components/DailyMessageActivity.tsx
import React, { useState, useEffect, useMemo } from 'react';

interface MessageData { date: string; count: number }
interface DailyMessageActivityProps {
    startDate?: string;
    endDate?: string;
    sessions?: any[];
    sessionRequests?: Record<string, any[]>;
    data?: { date: string; count: number }[];   // ✅ 추가
    totalOverride?: number;                     // ✅ 추가
  }

  const DailyMessageActivity: React.FC<DailyMessageActivityProps> = ({
    startDate, endDate, sessions = [], sessionRequests = {}, data, totalOverride
  }) => {
  const [messageData, setMessageData] = useState<MessageData[]>([]);
  const [totalMessages, setTotalMessages] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  // 로컬 날짜 키 생성 함수 수정
  const localDateKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // sessionRequests를 useMemo로 최적화
  const memoizedSessionRequests = useMemo(() => sessionRequests, [sessionRequests]);

  // Recent Conversations의 데이터를 직접 사용하도록 수정
  useEffect(() => {
    if (!startDate || !endDate) return;
    
    // 동일한 데이터로 중복 업데이트 방지
    const updateKey = `${startDate}-${endDate}-${sessions.length}-${JSON.stringify(sessionRequests)}`;
    if (updateKey === lastUpdate) return;
    
    setLastUpdate(updateKey);

    console.log('=== DailyMessageActivity Debug ===');
    console.log('Date range:', { startDate, endDate });
    console.log('Sessions count:', sessions.length);

    const dailyCounts: Record<string, number> = {};
    let totalCount = 0;

    sessions.forEach(session => {
      const sessionId = session?.sessionId || session?.id;
      const requests = (sessionRequests[sessionId] || []) as Array<{ createdAt?: string }>;
      
      console.log(`Session ${sessionId}:`, {
        sessionDate: session?.createdAt,
        requestsCount: requests.length
      });

      requests.forEach(req => {
        if (!req?.createdAt) return;
        
        // 날짜를 정확하게 처리 - 시간대 문제 해결
        const requestDate = new Date(req.createdAt);
        // UTC 시간을 로컬 시간으로 정확하게 변환
        const localDate = new Date(requestDate.getTime() - (requestDate.getTimezoneOffset() * 60000));
        const dateKey = localDate.toISOString().split('T')[0];
        
        dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
        totalCount += 1;
      });
    });

    console.log('Daily counts:', dailyCounts);
    console.log('Total count:', totalCount);

    // 날짜 범위를 정확하게 계산 - endDate까지 포함
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59');
    
    const display: MessageData[] = [];
    const current = new Date(start);
    
    while (current <= end) {
      const dateKey = current.toISOString().split('T')[0];
      display.push({ 
        date: dateKey, 
        count: dailyCounts[dateKey] || 0 
      });
      current.setDate(current.getDate() + 1);
    }

    console.log('Display data:', display);
    console.log('Total count:', totalCount);
    
    setMessageData(display);
    setTotalMessages(totalCount);
  }, [startDate, endDate, sessions, sessionRequests]);

  // Y축 범위 계산 (nice yMax)
  const rawMax = Math.max(...messageData.map(d => d.count), 0);
  const niceStep = (max: number) => {
    if (max <= 0) return 1;
    const pow = Math.pow(10, Math.floor(Math.log10(max)));
    const m = max / pow;
    const unit = m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10;
    return unit * pow;
  };
  const step = niceStep(rawMax || 1);
  const yMax = Math.max(1, Math.ceil((rawMax || 1) / step) * step);

  // 눈금(라인/라벨) — 동일 퍼센트 좌표 사용 (중복 key 방지)
  const tickCount = 6;
  const ticks = Array.from({ length: tickCount }, (_, i) => ({
    key: i,
    pct: (i / (tickCount - 1)) * 100,               // 0%~100% 균등
    label: Math.round((yMax * i) / (tickCount - 1)) // 표시 숫자
  }));

  return (
    <div className="daily-message-section">
      <div className="section-header">
        <h2 className="section-title">Daily Message Activity</h2>
        <div className="summary-text">
          Total: {totalMessages} messages | Avg: {messageData.length ? Math.round((totalMessages / messageData.length) * 10) / 10 : 0}/day
        </div>
      </div>

      <div className="period-info">
        <span className="period-text">
          Based on Recent Conversations: {startDate} to {endDate}
        </span>
      </div>

      <div className="performance-timeline-chart dma-chart">
        {/* 좌측 Y축 (라벨을 라인과 같은 퍼센트로) */}
        <div className="dma-yaxis-abs">
          {ticks.map(t => (
            <div key={`yt-${t.key}`} className="dma-tick" style={{ bottom: `${t.pct}%` }}>
              <span className="dma-ylabel">{t.label}</span>
            </div>
          ))}
        </div>

        {/* 플롯 */}
        <div className="dma-plot">
          {/* 수평 그리드 라인 (라벨과 같은 퍼센트) */}
          <div className="dma-grid-abs">
            {ticks.map(t => (
              <div key={`gl-${t.key}`} className="dma-hline" style={{ bottom: `${t.pct}%` }} />
            ))}
          </div>

          {/* Bars */}
{(() => {
  const n = messageData.length;
  const MAX_NO_SCROLL = 10;             // 10개까지는 스크롤 없이
  const needsScroll = n > MAX_NO_SCROLL;

  const BAR_W = needsScroll ? 40 : undefined;  // 막대 최소너비
  const GAP   = needsScroll ? 14 : 16;         // 간격

  const innerWidth = needsScroll
    ? (n * (BAR_W as number)) + ((n - 1) * GAP) + 16
    : undefined;

  return (
    <div
      className="dma-bars-scroll"
      style={{
        height: '100%',
        overflowX: needsScroll ? 'auto' : 'hidden',
        overflowY: 'hidden',
      }}
    >
      <div
        className="dma-bars"
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: needsScroll ? 'flex-start' : 'space-around',
          gap: `${GAP}px`,
          width: needsScroll ? `${innerWidth}px` : '100%',
        }}
      >
        {messageData.map(d => {
          const barHeight = yMax > 0 ? (d.count / yMax) * 100 : 0;
          
          // 날짜를 정확하게 파싱하여 라벨 생성
          const date = new Date(d.date + 'T00:00:00'); // 시간을 명시적으로 설정
          const month = date.getMonth() + 1;
          const day = date.getDate();
          const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
          const dayLabel = `${month}/${day} ${weekday}`;

          console.log(`Date: ${d.date} -> Label: ${dayLabel}`);

          return (
            <div className="dma-barwrap" key={d.date} title={`${dayLabel}: ${d.count}`}>
              {/* 막대 전용 영역 */}
              <div className="dma-barstack">
                <div className="dma-bar" style={{ height: `${barHeight}%` }}>
                  {d.count > 0 && <div className="dma-valuebubble">{d.count}</div>}
                  <div className="dma-barfill" />
                </div>
              </div>
              {/* X라벨 */}
              <div className="dma-xlabel">{dayLabel}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
})()}
        </div>
      </div>

    </div>
  );
};

export default DailyMessageActivity;