import { useEffect, useState } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { Stack, router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useNotificationStore } from '@/store/notificationStore'
import { initI18n } from '@/lib/i18n'
import { Colors } from '@/constants/colors'

// NOTE: expo-notifications is not imported here because it crashes Expo Go on SDK 53+.
// Push token registration is handled in lib/registerPush.ts and called from production
// builds only (npx expo run:android / npx expo run:ios).

export default function RootLayout() {
  const { setSession, fetchProfile, reset, profile } = useAuthStore()
  const { subscribe, unsubscribe } = useNotificationStore()
  const [i18nReady, setI18nReady] = useState(false)

  // Load translations before rendering anything
  useEffect(() => {
    initI18n().then(() => setI18nReady(true))
  }, [])

  useEffect(() => {
    // Restore session on cold start
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) fetchProfile(session.user.id)
      else reset()
    })

    // Keep session in sync with login / logout
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          unsubscribe()
          reset()
          router.replace('/(auth)/welcome')
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // Start Realtime notification channel once profile is loaded
  useEffect(() => {
    if (!profile) return
    subscribe(profile.user_id)
  }, [profile?.id])

  if (!i18nReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  )
}
