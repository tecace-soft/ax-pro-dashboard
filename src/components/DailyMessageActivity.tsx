// src/components/DailyMessageActivity.tsx
import React, { useState, useEffect, useMemo } from 'react';

interface MessageData { date: string; count: number }
// Recent Conversations에서 계산된 데이터를 props로 받기
interface DailyMessageActivityProps {
  startDate?: string;
  endDate?: string;
  sessions?: any[];
  sessionRequests?: Record<string, any[]>;
  // Recent Conversations에서 계산된 데이터를 직접 받기
  recentConversationsData?: { date: string; count: number }[];
}

const DailyMessageActivity: React.FC<DailyMessageActivityProps> = ({
  startDate, endDate, sessions = [], sessionRequests = {}
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

  // Content.tsx와 동일한 로직으로 데이터 처리
  useEffect(() => {
    if (!startDate || !endDate) return;

    console.log('=== DailyMessageActivity Debug ===');
    console.log('Date range:', { startDate, endDate });

    const dailyCounts: Record<string, number> = {};
    let totalCount = 0;

    sessions.forEach(session => {
      const sessionId = session?.sessionId || session?.id;
      const requests = (sessionRequests[sessionId] || []) as Array<{ createdAt?: string }>;
      
      requests.forEach(req => {
        if (!req?.createdAt) return;

        // 메시지 생성 시간을 기준으로 카운트 (세션 생성 시간이 아님)
        const requestDate = new Date(req.createdAt);
        
        // 시애틀 타임으로 변환
        const adjustedDate = new Date(requestDate.getTime() - (8 * 60 * 60 * 1000));
        const dateKey = adjustedDate.toISOString().split('T')[0];
        
        console.log(`Request: ${req.createdAt} -> Seattle time: ${dateKey} (Session created: ${session?.createdAt})`);

        // 날짜 범위 체크
        if (dateKey < startDate || dateKey > endDate) {
          console.log(`Skipping request outside range: ${dateKey}`);
          return;
        }

        dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
        totalCount += 1;
      });
    });

    console.log('Daily counts:', dailyCounts);
    console.log('Total count:', totalCount);

    // UI 표시용 데이터 생성
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const display: MessageData[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split('T')[0];
      display.push({ 
        date: dateKey, 
        count: dailyCounts[dateKey] || 0 
      });
    }

    setMessageData(display);
    setTotalMessages(totalCount);
  }, [startDate, endDate, sessions, sessionRequests]);

  // Y축 범위 계산 수정 - 더 여유로운 높이 제공
  const rawMax = Math.max(...messageData.map(d => d.count), 0);
  const niceStep = (max: number) => {
    if (max <= 0) return 1;
    const pow = Math.pow(10, Math.floor(Math.log10(max)));
    const m = max / pow;
    const unit = m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10;
    return unit * pow;
  };
  const step = niceStep(rawMax || 1);
  // 최소 20% 여유 공간 추가
  const yMax = Math.max(1, Math.ceil((rawMax || 1) / step) * step * 1.2);

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
        <div className="info-tooltip">
          {/* 명확한 정보 아이콘으로 변경 */}
          <svg className="info-icon" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="10"/>
            <text x="12" y="16" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">i</text>
          </svg>
          {/* 팝업을 컨테이너 안에 배치 */}
          <div className="tooltip-content">
            <div className="tooltip-header">
              <span>Count Method</span>
            </div>
            <div className="tooltip-body">
              Messages are counted by creation time, not session time. 
              Older session messages may appear in current dates.
            </div>
          </div>
        </div>
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