import React, { createContext, useContext, useState, useEffect } from 'react'

type Language = 'en' | 'ko'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export const useLanguage = () => {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}

interface LanguageProviderProps {
  children: React.ReactNode
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    'recentConversations': 'Recent Conversations',
    'adminFeedback': 'Administrator Feedback',
    'userFeedback': 'User Feedback',
    'promptControl': 'Prompt Control',
    'sort': 'Sort:',
    'search': 'Search:',
    'fontSize': 'Font Size:',
    'export': 'Export',
    'refresh': 'Refresh',
    'date': 'Date',
    'userId': 'User ID',
    'sessionId': 'Session ID',
    'userMessage': 'User Message',
    'aiResponse': 'AI Response',
    'userFb': 'User FB',
    'admin': 'Admin',
    'role': 'Role',
    'rating': 'Rating',
    'feedback': 'Feedback',
    'modified': 'Modified',
    'corrected': 'Corrected',
    'applied': 'Applied',
    'delete': 'Delete',
    'chatId': 'Chat ID',
    'reaction': 'Reaction',
    'comments': 'Comments',
    'dateTimeNewest': 'Date/Time (Newest First)',
    'sessionIdSort': 'Session ID',
    'conversationSearch': 'Search Conversations...',
    'searchFeedback': 'Search Feedback...',
    'loadMore': 'Show More',
    'remaining': 'remaining',
    'total': 'Total',
    'good': 'Good',
    'bad': 'Bad',
    'items': 'items',
    'feedbackItems': 'feedback items',
    'lastRefreshed': 'Last refreshed:',
    'systemPromptControl': 'System Prompt Control',
    'history': 'History',
    'expand': 'Expand',
    'saveChanges': 'Save Changes',
    'promptHistory': 'Prompt History',
    'current': 'Current',
    'load': 'Load'
  },
  ko: {
    'recentConversations': '최근 대화',
    'adminFeedback': '관리자 피드백',
    'userFeedback': '사용자 피드백',
    'promptControl': '프롬프트 제어',
    'sort': '정렬:',
    'search': '검색:',
    'fontSize': 'Font Size:',
    'export': '내보내기',
    'refresh': '새로고침',
    'date': '날짜',
    'userId': '사용자 ID',
    'sessionId': '세션 ID',
    'userMessage': '사용자 메시지',
    'aiResponse': 'AI 응답',
    'userFb': '사용자 피드백',
    'admin': '관리자',
    'role': '역할',
    'rating': '평점',
    'feedback': '피드백',
    'modified': '수정됨',
    'corrected': '수정된 답변',
    'applied': '적용됨',
    'delete': '삭제',
    'chatId': '채팅 ID',
    'reaction': '반응',
    'comments': '댓글',
    'dateTimeNewest': '날짜/시간 (최신순)',
    'sessionIdSort': '세션 ID',
    'conversationSearch': '대화 검색...',
    'searchFeedback': '피드백 검색...',
    'loadMore': '더 보기',
    'remaining': '개 남음',
    'total': '전체',
    'good': '좋음',
    'bad': '나쁨',
    'items': '개',
    'feedbackItems': '피드백 항목',
    'lastRefreshed': '최근 새로고침:',
    'systemPromptControl': '시스템 프롬프트 제어',
    'history': '이력',
    'expand': '확장',
    'saveChanges': '변경사항 저장',
    'promptHistory': '프롬프트 이력',
    'current': '현재',
    'load': '불러오기'
  }
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const savedLang = localStorage.getItem('language')
    if (savedLang === 'en' || savedLang === 'ko') {
      return savedLang
    }
    return 'en'
  })

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('language', lang)
  }

  const t = (key: string): string => {
    return translations[language][key] || key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}
