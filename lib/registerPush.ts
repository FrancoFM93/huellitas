// Push notification registration for production / dev builds.
// In Expo Go (SDK 53+) the native module is missing, so all calls no-op.

import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import Constants, { ExecutionEnvironment } from 'expo-constants'
import { supabase } from '@/lib/supabase'
import { getNotificationPath } from '@/lib/notificationRouting'

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient
const supportsNativePush = !isExpoGo && Platform.OS !== 'web'

export function setNotificationHandler() {
  if (!supportsNativePush) return
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  })
}

export async function registerForPush(profileId: string): Promise<void> {
  if (!supportsNativePush) return

  try {
    // Android 13+ will not display the permissions prompt until a channel exists.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Huellitas',
        importance: Notifications.AndroidImportance.HIGH,
      })
    }
    const { status: existing } = await Notifications.getPermissionsAsync()
    const finalStatus = existing === 'granted'
      ? existing
      : (await Notifications.requestPermissionsAsync()).status
    if (finalStatus !== 'granted') return

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
    if (!projectId) return
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId })
    const { error } = await supabase.from('profiles').update({ push_token: token }).eq('id', profileId)
    if (error) console.warn('Push registration could not be saved')
  } catch {
    // Permission/native/network failures must not interrupt sign-in.
    console.warn('Push registration is unavailable')
  }
}

/** The caller queues navigation until the navigator and authenticated profile are ready. */
export function addNotificationListeners(onTap: (data: Record<string, unknown>) => void) {
  if (!supportsNativePush) return () => {}
  let active = true
  const handled = new Set<string>()
  const handleResponse = (response: Notifications.NotificationResponse | null) => {
    if (!active || !response) return
    const identifier = `${response.notification.request.identifier}:${response.actionIdentifier}`
    if (handled.has(identifier)) return
    handled.add(identifier)
    const metadata = response.notification.request.content.data ?? {}
    if (getNotificationPath(metadata)) onTap(metadata)
    // Consume the response so a later ordinary launch does not reopen an old screen.
    void Notifications.clearLastNotificationResponseAsync().catch(() => {})
  }
  const listener = Notifications.addNotificationResponseReceivedListener(handleResponse)
  void Notifications.getLastNotificationResponseAsync().then(handleResponse).catch(() => {})
  return () => {
    active = false
    listener.remove()
  }
}

export function routeFromNotification(
  data: Record<string, unknown>,
  navigate: (path: string) => void
) {
  const path = getNotificationPath(data)
  if (path) navigate(path)
}
