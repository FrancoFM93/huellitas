import { useEffect, useState } from 'react'
import { View, ActivityIndicator, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Colors } from '@/constants/colors'
import { exchangeAuthCode } from '@/lib/authCallback'
import { getPostLoginRoute } from '@/lib/authRouting'
import { useAuthStore } from '@/store/authStore'

export default function AuthCallback() {
  const params = useLocalSearchParams<{ code?: string; error?: string }>()
  const code = typeof params.code === 'string' ? params.code : undefined
  const { t } = useTranslation()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    setFailed(false)
    if (!code || params.error) {
      setFailed(true)
      return
    }
    void exchangeAuthCode(code).then(async session => {
      if (!active) return
      const store = useAuthStore.getState()
      store.setSession(session)
      await store.fetchProfile(session.user.id)
      if (active) router.replace(getPostLoginRoute(useAuthStore.getState()))
    }).catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [code, params.error])

  return (
    <View style={styles.container}>
      {failed ? (
        <>
          <Text style={styles.text}>{t('auth.callback_error')}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => router.replace('/(auth)/login')} style={{ padding: 16 }}>
            <Text style={{ color: Colors.primary }}>{t('auth.back_to_login')}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.text}>{t('auth.callback_loading')}</Text>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background, padding: 24, gap: 16 },
  text: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center' },
})
