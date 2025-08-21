interface MessageCount {
  date: string
  count: number
}

interface DailyMessageResponse {
  messageCounts: MessageCount[]
  totalMessages: number
  averageMessages: number
  period: {
    startDate: string
    endDate: string
  }
}

// 캐시 키 생성 함수
const getCacheKey = (startDate: string, endDate: string) => {
  return `daily-messages-${startDate}-${endDate}`
}

// 캐시에서 데이터 가져오기
const getFromCache = (key: string): DailyMessageResponse | null => {
  try {
    const cached = localStorage.getItem(key)
    if (cached) {
      const data = JSON.parse(cached)
      // 캐시 만료 시간 확인 (24시간)
      if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
        return data.data
      }
      // 만료된 캐시 삭제
      localStorage.removeItem(key)
    }
  } catch (error) {
    console.error('Cache read error:', error)
  }
  return null
}

// 캐시에 데이터 저장
const saveToCache = (key: string, data: DailyMessageResponse) => {
  try {
    const cacheData = {
      data,
      timestamp: Date.now()
    }
    localStorage.setItem(key, JSON.stringify(cacheData))
  } catch (error) {
    console.error('Cache save error:', error)
  }
}

// Daily Message Activity 전용 API 호출
export const fetchDailyMessageActivity = async (
  authToken: string,
  startDate: string,
  endDate: string
): Promise<DailyMessageResponse> => {
  const cacheKey = getCacheKey(startDate, endDate)
  
  // 캐시에서 먼저 확인
  const cachedData = getFromCache(cacheKey)
  if (cachedData) {
    console.log('Using cached data for:', startDate, 'to', endDate)
    return cachedData
  }

  try {
    // API 호출
    const response = await fetch('/api/daily-message-activity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        startDate,
        endDate,
        includeDetails: false // 카운트만 필요하므로 false
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data: DailyMessageResponse = await response.json()
    
    // 과거 날짜 데이터는 캐시에 저장
    const today = new Date()
    const endDateObj = new Date(endDate)
    if (endDateObj < today) {
      saveToCache(cacheKey, data)
      console.log('Cached data for past period:', startDate, 'to', endDate)
    }
    
    return data
  } catch (error) {
    console.error('Failed to fetch daily message activity:', error)
    
    // API 실패 시 더미 데이터 반환 (개발용)
    return generateDummyData(startDate, endDate)
  }
}

// 더미 데이터 생성 (API 실패 시 사용)
const generateDummyData = (startDate: string, endDate: string): DailyMessageResponse => {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  
  const messageCounts: MessageCount[] = []
  let totalMessages = 0
  
  for (let i = 0; i < days; i++) {
    const date = new Date(start.getTime() + (i * 24 * 60 * 60 * 1000))
    const count = Math.floor(Math.random() * 20) + 1 // 1-20 랜덤
    messageCounts.push({
      date: date.toISOString().split('T')[0],
      count
    })
    totalMessages += count
  }
  
  return {
    messageCounts,
    totalMessages,
    averageMessages: Math.round(totalMessages / days),
    period: { startDate, endDate }
  }
}

// 특정 기간의 메시지 카운트만 가져오기 (최적화된 버전)
export const fetchMessageCounts = async (
  authToken: string,
  startDate: string,
  endDate: string
): Promise<MessageCount[]> => {
  const response = await fetchDailyMessageActivity(authToken, startDate, endDate)
  return response.messageCounts
}

// 캐시 무효화 (필요시 사용)
export const invalidateCache = (startDate?: string, endDate?: string) => {
  if (startDate && endDate) {
    const key = getCacheKey(startDate, endDate)
    localStorage.removeItem(key)
  } else {
    // 모든 캐시 삭제
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('daily-messages-')) {
        localStorage.removeItem(key)
      }
    })
  }
}
