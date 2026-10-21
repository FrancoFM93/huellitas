import type { StateCreator } from 'zustand'
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import type { AppNotification } from '@/types'

export interface NotificationStore {
  userId: string | null
  notifications: AppNotification[]
  unreadCount: number
  setNotifications: (notifications: AppNotification[]) => void
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  fetchNotifications: (userId: string) => Promise<void>
  subscribe: (userId: string) => void
  unsubscribe: () => void
}

const notificationState = (notifications: AppNotification[]) => ({
  notifications,
  unreadCount: notifications.filter((notification) => !notification.read).length,
})

export function createNotificationState(
  supabase: Pick<SupabaseClient, 'from' | 'channel' | 'removeChannel'>,
): StateCreator<NotificationStore> {
  let channel: RealtimeChannel | null = null
  // Invalidate requests and Realtime callbacks from a previous account/session.
  let generation = 0
  return (set, get) => ({
    userId: null,
    notifications: [],
    unreadCount: 0,

    setNotifications: (notifications) => set(notificationState(notifications)),

    markRead: async (id) => {
      const { userId } = get()
      const currentGeneration = generation
      if (!userId) return
      const { error } = await supabase.from('notifications').update({ read: true })
        .eq('id', id).eq('user_id', userId)
      if (error || generation !== currentGeneration) return
      set(notificationState(get().notifications.map((n) => n.id === id ? { ...n, read: true } : n)))
    },

    markAllRead: async () => {
      const { userId } = get()
      const currentGeneration = generation
      if (!userId) return
      const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', userId)
      if (error || generation !== currentGeneration) return
      set(notificationState(get().notifications.map((n) => ({ ...n, read: true }))))
    },

    fetchNotifications: async (userId) => {
      if (get().userId !== userId) return
      const currentGeneration = generation
      const { data, error } = await supabase.from('notifications').select('*')
        .eq('user_id', userId).order('created_at', { ascending: false }).limit(50)
      if (error || !data || generation !== currentGeneration) return
      // Keep inserts received while the initial query was in flight.
      const merged = new Map<string, AppNotification>()
      for (const n of [...get().notifications, ...data]) merged.set(n.id, n)
      const notifications = [...merged.values()]
        .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 50)
      set(notificationState(notifications))
    },

    subscribe: (userId) => {
      if (channel && get().userId === userId) return
      get().unsubscribe()
      const currentGeneration = generation
      set({ userId })
      channel = supabase.channel(`notifications:${userId}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}`,
        }, (payload) => {
          if (generation !== currentGeneration) return
          const incoming = payload.new as AppNotification
          if (incoming.user_id !== userId) return
          const notifications = [incoming, ...get().notifications.filter((n) => n.id !== incoming.id)].slice(0, 50)
          set(notificationState(notifications))
        }).subscribe()
      void get().fetchNotifications(userId).catch(() => {})
    },

    unsubscribe: () => {
      generation += 1
      if (channel) {
        void supabase.removeChannel(channel)
        channel = null
      }
      set({ userId: null, notifications: [], unreadCount: 0 })
    },
  })
}
