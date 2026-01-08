/**
 * Paystack Session Storage Utility
 * Manages localStorage for Paystack payment sessions and callbacks
 */

export interface PaystackSessionData {
  reference: string
  amount: number
  currency: 'NGN' | 'USD'
  userAddress: string
  email: string
  paystackUrl: string
  status: 'pending' | 'processing' | 'success' | 'failed'
  createdAt: number
  completedAt?: number
  expiresAt: number
}

export interface PaystackCallbackData {
  reference: string
  timestamp: number
  status: 'success' | 'failed'
  error?: string
}

const STORAGE_KEYS = {
  SESSION: 'paystack_session',
  CALLBACK: 'paystack_callback',
  HISTORY: 'paystack_history'
} as const

export class PaystackStorage {
  /**
   * Store a new Paystack session
   */
  static storeSession(sessionData: Omit<PaystackSessionData, 'createdAt' | 'expiresAt'>): PaystackSessionData {
    const now = Date.now()
    const fullSessionData: PaystackSessionData = {
      ...sessionData,
      createdAt: now,
      expiresAt: now + (15 * 60 * 1000) // 15 minutes expiry
    }
    
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(fullSessionData))
    
    // Also add to history
    this.addToHistory(fullSessionData)
    
    return fullSessionData
  }
  
  /**
   * Get current Paystack session
   */
  static getSession(): PaystackSessionData | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SESSION)
      if (!stored) return null
      
      const session: PaystackSessionData = JSON.parse(stored)
      
      // Check if session has expired
      if (Date.now() > session.expiresAt && session.status === 'pending') {
        session.status = 'expired'
        this.updateSession(session)
      }
      
      return session
    } catch (error) {
      console.error('Error getting Paystack session:', error)
      return null
    }
  }
  
  /**
   * Update existing session
   */
  static updateSession(updates: Partial<PaystackSessionData>): PaystackSessionData | null {
    const currentSession = this.getSession()
    if (!currentSession) return null
    
    const updatedSession = { ...currentSession, ...updates }
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(updatedSession))
    
    return updatedSession
  }
  
  /**
   * Clear current session
   */
  static clearSession(): void {
    localStorage.removeItem(STORAGE_KEYS.SESSION)
  }
  
  /**
   * Store callback data
   */
  static storeCallback(callbackData: PaystackCallbackData): void {
    localStorage.setItem(STORAGE_KEYS.CALLBACK, JSON.stringify(callbackData))
    
    // Update session if it matches
    const session = this.getSession()
    if (session && session.reference === callbackData.reference) {
      this.updateSession({
        status: callbackData.status,
        completedAt: callbackData.timestamp
      })
    }
  }
  
  /**
   * Get callback data without consuming it
   */
  static getCallback(): PaystackCallbackData | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CALLBACK)
      if (!stored) return null
      
      return JSON.parse(stored)
    } catch (error) {
      console.error('Error getting Paystack callback:', error)
      return null
    }
  }
  
  /**
   * Get and consume callback data (removes it after reading)
   */
  static consumeCallback(): PaystackCallbackData | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CALLBACK)
      if (!stored) return null
      
      const callback: PaystackCallbackData = JSON.parse(stored)
      
      // Remove callback data after reading
      localStorage.removeItem(STORAGE_KEYS.CALLBACK)
      
      return callback
    } catch (error) {
      console.error('Error consuming Paystack callback:', error)
      return null
    }
  }
  
  /**
   * Clear callback data manually
   */
  static clearCallback(): void {
    localStorage.removeItem(STORAGE_KEYS.CALLBACK)
  }
  
  /**
   * Check for pending callback
   */
  static hasPendingCallback(): boolean {
    return localStorage.getItem(STORAGE_KEYS.CALLBACK) !== null
  }
  
  /**
   * Add session to history
   */
  private static addToHistory(session: PaystackSessionData): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.HISTORY)
      const history: PaystackSessionData[] = stored ? JSON.parse(stored) : []
      
      // Add new session to beginning of array
      history.unshift(session)
      
      // Keep only last 10 sessions
      const trimmedHistory = history.slice(0, 10)
      
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(trimmedHistory))
    } catch (error) {
      console.error('Error adding to Paystack history:', error)
    }
  }
  
  /**
   * Get payment history
   */
  static getHistory(): PaystackSessionData[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.HISTORY)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('Error getting Paystack history:', error)
      return []
    }
  }
  
  /**
   * Clear all Paystack data
   */
  static clearAll(): void {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key)
    })
  }
  
  /**
   * Listen for storage changes (for cross-tab communication)
   */
  static onStorageChange(callback: (event: StorageEvent) => void): () => void {
    const handler = (event: StorageEvent) => {
      if (Object.values(STORAGE_KEYS).includes(event.key as any)) {
        callback(event)
      }
    }
    
    window.addEventListener('storage', handler)
    
    // Return cleanup function
    return () => window.removeEventListener('storage', handler)
  }
  
  /**
   * Get session status for UI
   */
  static getSessionStatus(): {
    hasSession: boolean
    isExpired: boolean
    isPending: boolean
    isCompleted: boolean
    reference?: string
  } {
    const session = this.getSession()
    
    if (!session) {
      return {
        hasSession: false,
        isExpired: false,
        isPending: false,
        isCompleted: false
      }
    }
    
    return {
      hasSession: true,
      isExpired: session.status === 'expired',
      isPending: session.status === 'pending',
      isCompleted: session.status === 'success',
      reference: session.reference
    }
  }
}

// Export convenience functions
export const {
  storeSession,
  getSession,
  updateSession,
  clearSession,
  storeCallback,
  getCallback,
  consumeCallback,
  clearCallback,
  hasPendingCallback,
  getHistory,
  clearAll,
  onStorageChange,
  getSessionStatus
} = PaystackStorage