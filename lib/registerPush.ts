// Push notification registration for production / dev builds.
// In Expo Go (SDK 53+) the native module is missing, so all calls no-op.

import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import Constants, { ExecutionEnvironment } from 'expo-constants'
import { supabase } from '@/lib/supabase'

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient

export function setNotificationHandler() {
  if (isExpoGo) return
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
  if (isExpoGo || Platform.OS === 'web') return

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

export function addNotificationListeners(onTap: (data: Record<string, any>) => void) {
  if (isExpoGo) return () => {}
  const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = (response.notification.request.content.data ?? {}) as Record<string, any>
    onTap(data)
  })
  // Cold-start: app opened from a tapped push
  Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response?.notification.request.content.data) {
      onTap(response.notification.request.content.data as Record<string, any>)
    }
  })
  return () => responseListener.remove()
}

export function routeFromNotification(
  data: Record<string, any>,
  navigate: (path: string) => void
) {
  if (data.session_id) navigate(`/monitoring/${data.session_id}`)
  else if (data.contract_id) navigate(`/adoption/contract/${data.contract_id}`)
  else if (data.post_id) navigate(`/adoption/${data.post_id}`)
  else if (data.alert_id) navigate(`/alerts/${data.alert_id}`)
  else if (data.fundraiser_id) navigate(`/fundraising/${data.fundraiser_id}`)
}
