'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export const OCR_MODES = {
  GEMINI: 'gemini',
  TESSERACT: 'tesseract',
  HYBRID: 'hybrid'
} as const

export type OCRMode = typeof OCR_MODES[keyof typeof OCR_MODES]

interface OCRModeContextType {
  mode: OCRMode
  setMode: (mode: OCRMode) => void
  toggleMode: () => void
  isOnline: boolean
  apiBaseUrl: string
  setApiBaseUrl: (url: string) => void
}

const OCRModeContext = createContext<OCRModeContextType | undefined>(undefined)

interface OCRModeProviderProps {
  children: ReactNode
}

export function OCRModeProvider({ children }: OCRModeProviderProps) {
  const [mode, setModeState] = useState<OCRMode>(() => {
    // Load from localStorage on mount (or default to Hybrid)
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ocrMode') as OCRMode
      return saved && Object.values(OCR_MODES).includes(saved)
        ? saved
        : OCR_MODES.HYBRID
    }
    return OCR_MODES.HYBRID
  })

  const [apiBaseUrl, setApiBaseUrlState] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ocrApiBaseUrl') || '/api/ocr'
    }
    return '/api/ocr'
  })

  const [isOnline, setIsOnline] = useState(true)

  // Persist mode changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ocrMode', mode)
    }
  }, [mode])

  // Persist API URL changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ocrApiBaseUrl', apiBaseUrl)
    }
  }, [apiBaseUrl])

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine)
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)

      return () => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      }
    }
  }, [])

  const setMode = (newMode: OCRMode) => {
    // Auto-fallback to Tesseract if offline and trying to use Gemini
    if (!isOnline && newMode === OCR_MODES.GEMINI) {
      console.warn('Offline: Falling back to Tesseract mode')
      setModeState(OCR_MODES.TESSERACT)
      return
    }
    
    setModeState(newMode)
  }

  const toggleMode = () => {
    const modes = Object.values(OCR_MODES)
    const currentIndex = modes.indexOf(mode)
    const nextIndex = (currentIndex + 1) % modes.length
    setMode(modes[nextIndex])
  }

  const setApiBaseUrl = (url: string) => {
    setApiBaseUrlState(url)
  }

  const value: OCRModeContextType = {
    mode,
    setMode,
    toggleMode,
    isOnline,
    apiBaseUrl,
    setApiBaseUrl
  }

  return (
    <OCRModeContext.Provider value={value}>
      {children}
    </OCRModeContext.Provider>
  )
}

export const useOCRMode = () => {
  const context = useContext(OCRModeContext)
  if (context === undefined) {
    throw new Error('useOCRMode must be used within an OCRModeProvider')
  }
  return context
}

// Hook for getting mode display info
export const useOCRModeInfo = () => {
  const { mode, isOnline } = useOCRMode()
  
  const getModeInfo = (selectedMode: OCRMode) => {
    switch (selectedMode) {
      case OCR_MODES.GEMINI:
        return {
          name: 'Gemini API',
          description: 'Server-side processing with high accuracy',
          pros: ['Highest accuracy', 'Structured data extraction', 'Multi-language support'],
          cons: ['Requires internet', 'API costs', 'Server dependency'],
          available: isOnline,
          recommended: true
        }
      case OCR_MODES.TESSERACT:
        return {
          name: 'Tesseract.js',
          description: 'Client-side processing, works offline',
          pros: ['Works offline', 'No API costs', 'Privacy-focused'],
          cons: ['Lower accuracy', 'Slower processing', 'Limited structure'],
          available: true,
          recommended: false
        }
      case OCR_MODES.HYBRID:
        return {
          name: 'Hybrid Mode',
          description: 'Best of both: Gemini with Tesseract fallback',
          pros: ['Adaptive accuracy', 'Offline fallback', 'Optimal results'],
          cons: ['Complex processing', 'Variable performance'],
          available: true,
          recommended: true
        }
      default:
        return {
          name: 'Unknown',
          description: 'Unknown OCR mode',
          pros: [],
          cons: [],
          available: false,
          recommended: false
        }
    }
  }

  return {
    currentMode: getModeInfo(mode),
    allModes: Object.values(OCR_MODES).map(getModeInfo),
    isOnline
  }
}