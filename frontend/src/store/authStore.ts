import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'
import { setCachedAuthToken } from '../api/client'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean

  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  initialize: () => () => void
}

// Token ready mechanism: resolves when the first valid token is cached
let _tokenReadyResolve: (() => void) | null = null
let _tokenReady: Promise<void> | null = null

/**
 * Wait for the auth token to be cached.
 * Returns true if token is available within timeout, false otherwise.
 */
export async function waitForToken(timeout = 5000): Promise<boolean> {
  // Check via the store's current state — if we already have a session, token is cached
  const state = useAuthStore.getState()
  if (state.session?.access_token) return true

  if (!_tokenReady) return false

  const result = await Promise.race([
    _tokenReady.then(() => true),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeout)),
  ])
  return result
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,

  signInWithGoogle: async () => {
    if (!supabase) return
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/auth/callback',
      },
    })
    if (error) {
      console.error('[auth] Google sign-in error:', error.message)
    }
  },

  signOut: async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setCachedAuthToken(null)
    set({ user: null, session: null })
  },

  initialize: () => {
    if (!supabase) {
      set({ loading: false })
      return () => {}
    }

    // Create the token-ready promise
    _tokenReady = new Promise<void>((resolve) => {
      _tokenReadyResolve = resolve
    })

    // 只使用 onAuthStateChange，它会立即触发 INITIAL_SESSION 事件
    // 不再调用 getSession()，避免两者各设置一次状态导致 user 引用变更触发重复 useEffect
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setCachedAuthToken(session?.access_token ?? null)
        set({
          session,
          user: session?.user ?? null,
          loading: false,
        })
        // Resolve token ready
        if (session?.access_token && _tokenReadyResolve) {
          _tokenReadyResolve()
          _tokenReadyResolve = null
        }
      }
    )

    return () => subscription.unsubscribe()
  },
}))
