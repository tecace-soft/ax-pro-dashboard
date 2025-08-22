import React, { useState, useEffect } from 'react';
import { getAuthToken } from '../services/auth';
import { fetchSessions } from '../services/sessions';
import { fetchSessionRequests } from '../services/requests';

interface MessageData {
  date: string;
  count: number;
}

const DailyMessageActivity: React.FC = () => {
  const [messageData, setMessageData] = useState<MessageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('7days');

  // Content.tsx와 정확히 동일한 방식으로 데이터 가져오기
  const fetchDailyMessageData = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      
      // Content.tsx와 동일한 날짜 형식 사용
      const today = new Date();
      const startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      // Content.tsx의 formatDateForAPI 함수와 동일한 방식
      const formatDateForAPI = (d: Date, isEndDate: boolean = false): string => {
        const localDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        
        if (isEndDate) {
          localDate.setHours(23, 59, 59, 999);
        } else {
          localDate.setHours(0, 0, 0, 0);
        }
        
        const koreaOffset = 9 * 60;
        const localOffset = localDate.getTimezoneOffset();
        const offsetDifference = koreaOffset + localOffset;
        const koreaTime = new Date(localDate.getTime() + (offsetDifference * 60 * 1000));
        
        const year = koreaTime.getFullYear();
        const month = String(koreaTime.getMonth() + 1).padStart(2, '0');
        const day = String(koreaTime.getDate()).padStart(2, '0');
        const hours = String(koreaTime.getHours()).padStart(2, '0');
        const minutes = String(koreaTime.getMinutes()).padStart(2, '0');
        const seconds = String(koreaTime.getSeconds()).padStart(2, '0');
        
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      };
      
      // Content.tsx와 동일한 API 호출
      const apiStartDate = formatDateForAPI(startDate, false);
      const apiEndDate = formatDateForAPI(today, true);
      
      console.log('API call dates:', { apiStartDate, apiEndDate }); // 디버깅용
      
      const sessionsResponse = await fetchSessions(token, apiStartDate, apiEndDate);
      
      // 일별 메시지 카운트 계산
      const dailyCounts: Record<string, number> = {};
      
      for (const session of sessionsResponse.sessions || []) {
        const requests = await fetchSessionRequests(token, session.sessionId, apiStartDate, apiEndDate);
        const requestCount = requests.requests?.length || 0;
        
        const date = new Date(session.createdAt).toISOString().split('T')[0];
        dailyCounts[date] = (dailyCounts[date] || 0) + requestCount;
      }
      
      // 7일 데이터만 UI에 표시
      const displayData: MessageData[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        displayData.push({
          date: date,
          count: dailyCounts[date] || 0
        });
      }
      
      setMessageData(displayData);
    } catch (error) {
      console.error('Failed to fetch daily message data:', error);
      setMessageData([]); // 에러 시 빈 배열로 설정
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDailyMessageData();
  }, [selectedPeriod]);

  return (
    <div className="daily-message-section">
      <div className="section-header">
        <h2 className="section-title">Daily Message Activity</h2>
        <div className="period-selector">
          <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}>
            <option value="7days">Last 7 Days</option>
            <option value="14days">Last 14 Days</option>
            <option value="30days">Last 30 Days</option>
          </select>
        </div>
      </div>
      
      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <div className="chart-container">
          {messageData.map((data, index) => (
            <div key={data.date} className="chart-bar">
              <div className="bar-value" style={{ height: `${(data.count / Math.max(...messageData.map(d => d.count), 1)) * 100}%` }}></div>
              <div className="bar-label">{new Date(data.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DailyMessageActivity;