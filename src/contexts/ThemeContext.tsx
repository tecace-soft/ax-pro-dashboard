import React, { createContext, useContext, useState, useEffect } from 'react'

type Theme = 'dark' | 'light'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

interface ThemeProviderProps {
  children: React.ReactNode
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Always default to dark theme first
    // Set it immediately to prevent flash of wrong theme
    if (typeof window !== 'undefined') {
      document.documentElement.setAttribute('data-theme', 'dark')
    }
    
    // localStorage에서 저장된 테마 불러오기
    const savedTheme = typeof window !== 'undefined' ? localStorage.getItem('theme') : null
    if (savedTheme === 'light' || savedTheme === 'dark') {
      // Update immediately if saved theme exists
      if (typeof window !== 'undefined') {
        document.documentElement.setAttribute('data-theme', savedTheme)
      }
      return savedTheme
    }
    // Always default to dark theme (don't use system preference)
    return 'dark'
  })

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem('theme', newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  useEffect(() => {
    // HTML 요소에 테마 속성 설정 (초기 설정)
    document.documentElement.setAttribute('data-theme', theme)
    
    // CSS 변수 업데이트
    const root = document.documentElement
    if (theme === 'light') {
      root.style.setProperty('--bg-primary', '#ffffff')
      root.style.setProperty('--bg-secondary', '#f8fafc')
      root.style.setProperty('--bg-tertiary', '#f1f5f9')
      root.style.setProperty('--bg-card', '#ffffff')
      root.style.setProperty('--bg-sidebar', '#f8fafc')
      root.style.setProperty('--text-primary', '#0f172a')
      root.style.setProperty('--text-secondary', '#475569')
      root.style.setProperty('--text-muted', '#64748b')
      root.style.setProperty('--border-primary', '#e2e8f0')
      root.style.setProperty('--border-secondary', '#cbd5e1')
      root.style.setProperty('--accent-primary', '#3be6ff')
      root.style.setProperty('--accent-secondary', '#22c55e')
      root.style.setProperty('--shadow-primary', '0 1px 3px rgba(0, 0, 0, 0.1)')
      root.style.setProperty('--shadow-secondary', '0 4px 6px rgba(0, 0, 0, 0.1)')
      root.style.setProperty('--shadow-card', '0 1px 3px rgba(0, 0, 0, 0.1)')
    } else {
      root.style.setProperty('--bg-primary', '#0f172a')
      root.style.setProperty('--bg-secondary', '#1e293b')
      root.style.setProperty('--bg-tertiary', '#334155')
      root.style.setProperty('--bg-card', '#1e293b')
      root.style.setProperty('--bg-sidebar', '#0f172a')
      root.style.setProperty('--text-primary', '#ffffff')
      root.style.setProperty('--text-secondary', '#cbd5e1')
      root.style.setProperty('--text-muted', '#94a3b8')
      root.style.setProperty('--border-primary', '#475569')
      root.style.setProperty('--border-secondary', '#334155')
      root.style.setProperty('--accent-primary', '#3be6ff')
      root.style.setProperty('--accent-secondary', '#22c55e')
      root.style.setProperty('--shadow-primary', '0 1px 3px rgba(0, 0, 0, 0.3)')
      root.style.setProperty('--shadow-secondary', '0 4px 6px rgba(0, 0, 0, 0.3)')
      root.style.setProperty('--shadow-card', '0 1px 3px rgba(0, 0, 0, 0.3)')
    }
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}