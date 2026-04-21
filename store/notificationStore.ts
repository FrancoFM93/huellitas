import { create } from 'zustand'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { AppNotification } from '@/types'
import { supabase } from '@/lib/supabase'

interface NotificationStore {
  notifications: AppNotification[]
  unreadCount: number

  setNotifications: (notifications: AppNotification[]) => void
  markRead: (id: string) => void
  markAllRead: () => void
  fetchNotifications: (userId: string) => Promise<void>

  // Realtime: call subscribe() once on login, unsubscribe() on logout
  subscribe: (userId: string) => void
  unsubscribe: () => void
}

// Kept outside the store so we can clean it up on logout
let channel: RealtimeChannel | null = null

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,

  setNotifications: (notifications) =>
    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
    }),

  markRead: async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    const updated = get().notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    )
    set({ notifications: updated, unreadCount: updated.filter((n) => !n.read).length })
  },

  markAllRead: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id)
    const updated = get().notifications.map((n) => ({ ...n, read: true }))
    set({ notifications: updated, unreadCount: 0 })
  },

  fetchNotifications: async (userId: string) => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) {
      set({
        notifications: data,
        unreadCount: data.filter((n) => !n.read).length,
      })
    }
  },

  /**
   * Opens a Supabase Realtime channel that listens for new notifications
   * for this user. New rows are prepended to the list instantly.
   */
  subscribe: (userId: string) => {
    // Avoid duplicate channels
    if (channel) return

    channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const incoming = payload.new as AppNotification
          const current = get().notifications
          // Prepend so the newest shows first
          const updated = [incoming, ...current]
          set({ notifications: updated, unreadCount: updated.filter((n) => !n.read).length })
        },
      )
      .subscribe()
  },

  unsubscribe: () => {
    if (channel) {
      supabase.removeChannel(channel)
      channel = null
    }
  },
}))
