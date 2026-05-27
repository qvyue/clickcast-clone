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
}))

// Auto-initialize auth subscription at module load time.
// This runs once when the JS module is evaluated, outside React's lifecycle,
// so StrictMode double-mounting cannot create duplicate subscriptions.
let _initialized = false
if (supabase && !_initialized) {
  _initialized = true
  _tokenReady = new Promise<void>((resolve) => {
    _tokenReadyResolve = resolve
  })
  supabase.auth.onAuthStateChange((_event, session) => {
    setCachedAuthToken(session?.access_token ?? null)
    useAuthStore.setState({ session, user: session?.user ?? null, loading: false })
    if (session?.access_token && _tokenReadyResolve) {
      _tokenReadyResolve()
      _tokenReadyResolve = null
    }
  })
} else if (!supabase) {
  useAuthStore.setState({ loading: false })
}
