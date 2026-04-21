// Push notification registration for production builds.
// Import and call registerForPush() from _layout.tsx only in dev/prod builds,
// NOT in Expo Go (SDK 53+ removed push support from Expo Go).
//
// To enable: run `npx expo run:android` or `npx expo run:ios` instead of Expo Go.

import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { supabase } from '@/lib/supabase'

export function setNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  })
}

export async function registerForPush(profileId: string): Promise<void> {
  if (Platform.OS === 'web') return

  const { status: existing } = await Notifications.getPermissionsAsync()
  let finalStatus = existing

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') return

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId })
    await supabase.from('profiles').update({ push_token: token }).eq('id', profileId)
  } catch {
    // Silently skip if EAS project is not configured yet
  }
}

export function addNotificationListeners(onTap: (data: Record<string, string>) => void) {
  const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as Record<string, string>
    onTap(data)
  })
  return () => responseListener.remove()
}
