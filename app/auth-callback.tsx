import { useEffect } from 'react'
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { Colors } from '@/constants/colors'

export default function AuthCallback() {
  useEffect(() => {
    const t = setTimeout(() => router.replace('/'), 400)
    return () => clearTimeout(t)
  }, [])

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
      <Text style={styles.text}>Completando inicio de sesión…</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    gap: 16,
  },
  text: { color: Colors.textSecondary, fontSize: 14 },
})
