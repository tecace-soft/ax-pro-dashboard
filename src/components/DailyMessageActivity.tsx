// src/components/DailyMessageActivity.tsx
import React, { useState, useEffect } from 'react';

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

  // 로컬 날짜 키 (YYYY-MM-DD)
  const localDateKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // 데이터 집계: "요청(createdAt)" 기준 + 로컬 날짜 + 기간 필터
  useEffect(() => {
    // 1) 외부에서 이미 계산된 데이터가 오면 그대로 사용
    if (data && data.length) {
      setMessageData(data);
      setTotalMessages(
        typeof totalOverride === 'number'
          ? totalOverride
          : data.reduce((s, d) => s + (d.count || 0), 0)
      );
      return; // ✅ 내부 집계 스킵
    }
  
    // 2) 외부 데이터가 없을 때만 기존 방식으로 집계
    if (!startDate || !endDate) return;
  
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T23:59:59`);
  
    const dailyCounts: Record<string, number> = {};
    let totalCount = 0;
  
    sessions.forEach(session => {
      const sessionId = session.sessionId || session.id;
      const requests = (sessionRequests[sessionId] || []) as Array<{ createdAt?: string }>;
      requests.forEach(req => {
        if (!req?.createdAt) return;
        const t = new Date(req.createdAt);
        if (t < start || t > end) return;
        const key = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
        dailyCounts[key] = (dailyCounts[key] || 0) + 1;
        totalCount += 1;
      });
    });
  
    const display: {date: string; count: number}[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`;
      display.push({ date: key, count: dailyCounts[key] || 0 });
      cur.setDate(cur.getDate() + 1);
    }
  
    setMessageData(display);
    setTotalMessages(totalCount);
  }, [startDate, endDate, sessions, sessionRequests, data, totalOverride]);

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
          const dayLabel = new Date(d.date).toLocaleDateString('ko-KR', {
            month: 'short',
            day: 'numeric',
          });

          return (
            <div className="dma-barwrap" key={d.date} title={`${dayLabel}: ${d.count}`}>
              <div className="dma-barstack">
                <div
                  className="dma-bar"
                  style={{
                    height: `${barHeight}%`,
                    width: BAR_W ? `${BAR_W}px` : undefined,
                  }}
                >
                  {d.count > 0 && <div className="dma-valuebubble">{d.count}</div>}
                  <div className="dma-barfill" />
                </div>
              </div>
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