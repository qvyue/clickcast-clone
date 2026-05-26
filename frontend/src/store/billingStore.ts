import { create } from 'zustand'
import {
  createCheckout,
  getSubscription,
  getCredits,
  createPortal,
  type SubscriptionInfo,
} from '../api/client'
import { waitForToken } from './authStore'

interface BillingState {
  subscription: SubscriptionInfo | null
  credits: number
  loading: boolean

  fetchSubscription: () => Promise<void>
  fetchCredits: () => Promise<void>
  startCheckout: (mode: 'pro' | 'credit_pack') => Promise<void>
  openPortal: () => Promise<void>
  refresh: () => Promise<void>
}

export const useBillingStore = create<BillingState>((set, get) => ({
  subscription: null,
  credits: 0,
  loading: false,

  fetchSubscription: async () => {
    await waitForToken()
    try {
      const data = await getSubscription()
      set({ subscription: data.subscription })
    } catch {
      // Not logged in or billing not configured
      set({ subscription: null })
    }
  },

  fetchCredits: async () => {
    await waitForToken()
    try {
      const data = await getCredits()
      set({ credits: data.credits })
    } catch {
      set({ credits: 0 })
    }
  },

  startCheckout: async (mode) => {
    await waitForToken()
    try {
      const data = await createCheckout(mode)
      if (data.url) {
        window.location.href = data.url
      }
    } catch (e: any) {
      console.error('[billing] Checkout error:', e.message)
      alert(e.message || 'Failed to start checkout')
    }
  },

  openPortal: async () => {
    await waitForToken()
    try {
      const data = await createPortal()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (e: any) {
      console.error('[billing] Portal error:', e.message)
      alert(e.message || 'Failed to open portal')
    }
  },

  refresh: async () => {
    set({ loading: true })
    await waitForToken()
    await Promise.all([get().fetchSubscription(), get().fetchCredits()])
    set({ loading: false })
  },
}))
