import { Stack, Redirect } from 'expo-router'
import { useAuthStore } from '@/store/authStore'

export default function AdminLayout() {
  const profile = useAuthStore((s) => s.profile)
  if (!profile || profile.role !== 'admin') return <Redirect href="/(tabs)" />
  return <Stack screenOptions={{ headerShown: false }} />
}
