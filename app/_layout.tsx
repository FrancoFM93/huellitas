import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, AppState, Platform, View } from 'react-native'
import { Stack, router, useRootNavigationState } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useNotificationStore } from '@/store/notificationStore'
import { initI18n } from '@/lib/i18n'
import { Colors } from '@/constants/colors'
import {
  setNotificationHandler, registerForPush, addNotificationListeners, routeFromNotification,
} from '@/lib/registerPush'

setNotificationHandler()

const protectedRoutes = [
  '(tabs)', 'admin', 'adoption/[id]', 'adoption/apply/[postId]',
  'adoption/contract/[contractId]', 'adoption/edit/[id]', 'adoption/new',
  'alerts/[id]', 'alerts/new', 'clinics/[id]', 'fundraising/[id]', 'fundraising/new',
  'messages/[threadId]', 'messages/index', 'missing/[id]', 'missing/new/[petId]',
  'monitoring/[sessionId]', 'orgs/[id]', 'pets/[id]', 'pets/edit/[id]', 'pets/new',
  'profile/[id]', 'profile/delete-account', 'profile/edit', 'profile/my-applications',
  'profile/my-posts', 'profile/settings', 'vets/[id]',
] as const

export default function RootLayout() {
  const { setSession, fetchProfile, reset, session, profile, profileError, isLoading } = useAuthStore()
  const { subscribe, unsubscribe } = useNotificationStore()
  const [i18nReady, setI18nReady] = useState(false)
  const [pendingNotification, setPendingNotification] = useState<Record<string, unknown> | null>(null)
  const navigation = useRootNavigationState()
  const previousUserId = useRef<string | undefined>(undefined)

  useEffect(() => {
    let active = true
    void initI18n().catch(() => undefined).finally(() => { if (active) setI18nReady(true) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    let eventReceived = false
    // Do not await Supabase requests inside this callback: the auth client may
    // still hold its session lock. Profile loading happens in a separate effect.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      eventReceived = true
      if (nextSession) setSession(nextSession)
      else reset()
    })
    void supabase.auth.getSession().then(({ data: { session: initial }, error }) => {
      if (!active || eventReceived) return
      if (error || !initial) reset()
      else setSession(initial)
    }).catch(() => { if (active && !eventReceived) reset() })
    return () => { active = false; subscription.unsubscribe() }
  }, [setSession, reset])

  const userId = session?.user.id
  useEffect(() => {
    if (previousUserId.current && previousUserId.current !== userId) setPendingNotification(null)
    previousUserId.current = userId
    if (userId) void fetchProfile(userId)
  }, [userId, fetchProfile])

  useEffect(() => {
    if (Platform.OS === 'web') return
    const syncRefresh = (state: string) => {
      if (state === 'active') supabase.auth.startAutoRefresh()
      else supabase.auth.stopAutoRefresh()
    }
    syncRefresh(AppState.currentState)
    const subscription = AppState.addEventListener('change', syncRefresh)
    return () => { subscription.remove(); supabase.auth.stopAutoRefresh() }
  }, [])

  const profileId = profile?.id
  const profileUserId = profile?.user_id
  useEffect(() => {
    if (!profileId || !profileUserId) return
    subscribe(profileUserId)
    void registerForPush(profileId)
    return unsubscribe
  }, [profileId, profileUserId, subscribe, unsubscribe])

  useEffect(() => {
    if (!i18nReady || !navigation?.key) return
    return addNotificationListeners(setPendingNotification)
  }, [i18nReady, navigation?.key])

  useEffect(() => {
    if (!pendingNotification || !navigation?.key || isLoading || !session || !profile || profileError) return
    routeFromNotification(pendingNotification, router.push)
    setPendingNotification(null)
  }, [pendingNotification, navigation?.key, isLoading, session, profile, profileError])

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
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="auth-callback" />
        <Stack.Protected guard={!!session && !!profile && !profileError}>
          {protectedRoutes.map(name => <Stack.Screen key={name} name={name} />)}
        </Stack.Protected>
      </Stack>
    </QueryClientProvider>
  )
}
