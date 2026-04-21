import { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '@/store/authStore'
import { Colors } from '@/constants/colors'

export default function Index() {
  const { session, profile, isLoading } = useAuthStore()

  useEffect(() => {
    if (isLoading) return

    if (!session) {
      router.replace('/(auth)/welcome')
    } else if (!profile) {
      router.replace('/(auth)/onboarding')
    } else {
      router.replace('/(tabs)')
    }
  }, [session, profile, isLoading])

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  )
}
