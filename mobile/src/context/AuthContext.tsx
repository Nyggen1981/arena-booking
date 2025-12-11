import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import * as SecureStore from 'expo-secure-store'
import { User } from '../types'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const API_BASE_URL = 'https://arena-booking.vercel.app'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

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
