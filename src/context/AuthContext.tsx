import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { UserProfile, UserRole } from '@/types'

interface SignInResult {
  error: Error | null
  user?: User | null
  profile?: UserProfile | null
  role?: UserRole | null
}

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  role: UserRole | null
  isLoading: boolean
  isAuthenticated: boolean
  signInWithPassword: (email: string, password: string) => Promise<SignInResult>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Fetch profile from public.users_profile with fallback to auth metadata
  const fetchProfile = useCallback(async (userId: string, authUser?: User | null) => {
    try {
      const { data, error } = await supabase
        .from('users_profile')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        console.warn('Profile fetch note:', error.message)
      }

      if (data) {
        const loadedProfile = data as UserProfile
        setProfile(loadedProfile)
        return loadedProfile
      } else {
        // Fallback: If not in public.users_profile yet, construct from auth metadata
        const metadataRole = (authUser?.user_metadata?.role as UserRole) || 'tutor'
        const metadataNama = authUser?.user_metadata?.nama || authUser?.email?.split('@')[0] || 'Karyawan'
        const fallbackProfile: UserProfile = {
          id: userId,
          nama: metadataNama,
          email: authUser?.email,
          role: metadataRole,
        }
        setProfile(fallbackProfile)

        // Asynchronously upsert profile to DB
        supabase
          .from('users_profile')
          .upsert({
            id: userId,
            nama: metadataNama,
            email: authUser?.email,
            role: metadataRole,
          })
          .then(() => {})

        return fallbackProfile
      }
    } catch (err) {
      console.error('Unexpected error fetching profile:', err)
      return null
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    // 1. Initial Session Check
    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession()
        if (error) throw error

        if (isMounted) {
          setSession(initialSession)
          setUser(initialSession?.user ?? null)
          if (initialSession?.user) {
            await fetchProfile(initialSession.user.id, initialSession.user)
          }
        }
      } catch (error) {
        console.error('Error initializing auth session:', error)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    initializeAuth()

    // 2. Realtime Auth State Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, currentSession) => {
        if (!isMounted) return

        setSession(currentSession)
        setUser(currentSession?.user ?? null)

        if (currentSession?.user) {
          await fetchProfile(currentSession.user.id, currentSession.user)
        } else {
          setProfile(null)
        }
        setIsLoading(false)
      }
    )

    // 3. Cleanup listener on unmount
    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  const signInWithPassword = async (email: string, password: string): Promise<SignInResult> => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (error) {
        return { error }
      }

      if (data.user) {
        setUser(data.user)
        setSession(data.session)
        const loadedProfile = await fetchProfile(data.user.id, data.user)
        const effectiveRole = loadedProfile?.role || (data.user.user_metadata?.role as UserRole) || 'tutor'
        return {
          error: null,
          user: data.user,
          profile: loadedProfile,
          role: effectiveRole,
        }
      }

      return { error: null }
    } catch (err: any) {
      return { error: err }
    } finally {
      setIsLoading(false)
    }
  }

  const signOut = async () => {
    setIsLoading(true)
    try {
      await supabase.auth.signOut()
      setUser(null)
      setSession(null)
      setProfile(null)
    } catch (err) {
      console.error('Error signing out:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchProfile(user.id, user)
    }
  }

  // Effective role computation: profile.role > user.user_metadata.role > null
  const effectiveRole: UserRole | null =
    profile?.role || (user?.user_metadata?.role as UserRole) || null

  const value: AuthContextType = {
    user,
    session,
    profile,
    role: effectiveRole,
    isLoading,
    isAuthenticated: !!user,
    signInWithPassword,
    signOut,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
