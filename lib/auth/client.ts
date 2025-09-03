'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  loading: boolean
  error: Error | null
}

export function useAuth(requireAuth: boolean = true) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null
  })
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        
        if (error) throw error
        
        if (requireAuth && !user) {
          router.push('/auth/login')
          return
        }
        
        setAuthState({ user, loading: false, error: null })
      } catch (error) {
        setAuthState({ 
          user: null, 
          loading: false, 
          error: error as Error 
        })
        
        if (requireAuth) {
          router.push('/auth/login')
        }
      }
    }

    checkAuth()

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setAuthState({ user: null, loading: false, error: null })
          if (requireAuth) {
            router.push('/auth/login')
          }
        } else if (session) {
          setAuthState({ 
            user: session.user, 
            loading: false, 
            error: null 
          })
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [requireAuth, router, supabase])

  return authState
}

export function useSupabase() {
  return createClient()
}