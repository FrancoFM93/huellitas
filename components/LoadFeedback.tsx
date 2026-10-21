import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Colors } from '@/constants/colors'

interface LoadFeedbackProps {
  loading?: boolean
  message?: string
  onRetry?: () => void
  onBack?: () => void
}

export function LoadFeedback({ loading, message, onRetry, onBack }: LoadFeedbackProps) {
  const { t } = useTranslation()

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator color={Colors.primary} accessibilityLabel={t('common.loading')} />
      ) : (
        <>
          <Text style={styles.message} accessibilityRole="alert">{message}</Text>
          {onRetry ? (
            <TouchableOpacity style={styles.button} onPress={onRetry} accessibilityRole="button">
              <Text style={styles.buttonText}>{t('common.retry')}</Text>
            </TouchableOpacity>
          ) : null}
        </>
      )}
      {onBack ? (
        <TouchableOpacity style={styles.button} onPress={onBack} accessibilityRole="button">
          <Text style={styles.buttonText}>{t('common.back')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 16, alignItems: 'center', justifyContent: 'center' },
  message: { color: Colors.textSecondary, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  button: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.primaryLight },
  buttonText: { color: Colors.primaryDark, fontSize: 14, fontWeight: '700' },
})
