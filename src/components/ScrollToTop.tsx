import { useState, useEffect } from 'react'
import { IconChevronUp } from '../ui/icons'

export default function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.pageYOffset > 300) {
        setIsVisible(true)
      } else {
        setIsVisible(false)
      }
    }

    window.addEventListener('scroll', toggleVisibility)
    return () => window.removeEventListener('scroll', toggleVisibility)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }

  if (!isVisible) {
    return null
  }

  return (
    <button
      className="scroll-to-top"
      onClick={scrollToTop}
      aria-label="Scroll to top"
      title="맨 위로 스크롤"
      style={{
        position: 'fixed',
        bottom: '30px',
        right: '30px',
        left: 'auto',
        top: 'auto',
        zIndex: 99999,
        float: 'right'
      }}
    >
      <IconChevronUp size={24} />
    </button>
  )
}
