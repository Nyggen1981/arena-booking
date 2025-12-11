import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react'
import * as SecureStore from 'expo-secure-store'
import * as Notifications from 'expo-notifications'
import { User } from '../types'
import { 
  registerForPushNotificationsAsync, 
  savePushTokenToServer,
  addNotificationListeners 
} from '../utils/notifications'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  unreadCount: number
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Using production URL for testing (change back for local development)
const API_BASE_URL = 'https://arena-booking.vercel.app'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const notificationListener = useRef<() => void>()

  useEffect(() => {
    checkAuth()
  }, [])

  // Set up push notifications when user is authenticated
  useEffect(() => {
    if (user) {
      setupPushNotifications()
      fetchUnreadCount()
    }

    return () => {
      if (notificationListener.current) {
        notificationListener.current()
      }
    }
  }, [user])

  async function setupPushNotifications() {
    const token = await registerForPushNotificationsAsync()
    
    if (token && user) {
      await savePushTokenToServer(token.token, user.id)
    }

    // Listen for notifications
    notificationListener.current = addNotificationListeners(
      (notification) => {
        // Handle incoming notification
        console.log('Notification received:', notification)
        fetchUnreadCount()
      },
      (response) => {
        // Handle notification tap
        console.log('Notification tapped:', response)
        // Navigate to relevant screen based on notification data
      }
    )
  }

  async function fetchUnreadCount() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/bookings/unread`, {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setUnreadCount(data.upcoming + data.history)
      }
    } catch (error) {
      console.error('Error fetching unread count:', error)
    }
  }

  async function checkAuth() {
    try {
      const sessionData = await SecureStore.getItemAsync('session')
      if (sessionData) {
        const session = JSON.parse(sessionData)
        setUser(session.user)
      }
    } catch (error) {
      console.error('Error checking auth:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function login(email: string, password: string) {
    setIsLoading(true)
    try {
      // Call your login API
      const response = await fetch(`${API_BASE_URL}/api/auth/mobile-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Innlogging feilet')
      }

      const data = await response.json()
      
      // Store session
      await SecureStore.setItemAsync('session', JSON.stringify(data))
      setUser(data.user)
    } catch (error) {
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  async function logout() {
    setIsLoading(true)
    try {
      await SecureStore.deleteItemAsync('session')
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  async function refreshUser() {
    try {
      const sessionData = await SecureStore.getItemAsync('session')
      if (sessionData) {
        const session = JSON.parse(sessionData)
        // Optionally refresh from server
        setUser(session.user)
      }
    } catch (error) {
      console.error('Error refreshing user:', error)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        login,
        logout,
        refreshUser,
        unreadCount,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

