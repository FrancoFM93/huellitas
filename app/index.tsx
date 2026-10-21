import { useEffect } from 'react'
import { View, ActivityIndicator, Text, TouchableOpacity, Alert } from 'react-native'
import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { Colors } from '@/constants/colors'

export default function Index() {
  const { session, profile, isLoading, profileError, fetchProfile, signOut } = useAuthStore()
  const { t } = useTranslation()

  useEffect(() => {
    if (isLoading || profileError) return
    if (!session) router.replace('/(auth)/welcome')
    else if (profile) router.replace('/(tabs)')
  }, [session, profile, isLoading, profileError])

  const deleted = profileError === 'account_deleted'
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16, backgroundColor: Colors.background }}>
      {profileError && !isLoading ? (
        <>
          <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.text, textAlign: 'center' }}>
            {t(deleted ? 'auth.account_deleted_title' : 'auth.profile_error_title')}
          </Text>
          <Text style={{ color: Colors.textSecondary, textAlign: 'center' }}>
            {t(deleted ? 'auth.account_deleted_body' : profileError === 'profile_missing' ? 'auth.profile_missing_body' : 'auth.profile_error_body')}
          </Text>
          {!deleted && session ? (
            <TouchableOpacity accessibilityRole="button" onPress={() => void fetchProfile(session.user.id)} style={{ padding: 16 }}>
              <Text style={{ color: Colors.primary, fontWeight: '700' }}>{t('auth.retry')}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity accessibilityRole="button" onPress={() => void signOut().catch(() => Alert.alert(t('auth.error_title'), t('auth.profile_error_body')))} style={{ padding: 16 }}>
            <Text style={{ color: Colors.primary }}>{t('auth.sign_out')}</Text>
          </TouchableOpacity>
        </>
      ) : <ActivityIndicator size="large" color={Colors.primary} />}
    </View>
  )
}
