import { StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Colors } from '@/constants/colors'

export function DonationsUnavailable() {
  const { t } = useTranslation()

  return (
    <View style={styles.notice}>
      <Text style={styles.title}>{t('fund.unavailable_title')}</Text>
      <Text style={styles.message}>{t('fund.unavailable_message')}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  notice: { backgroundColor: Colors.primaryLight, padding: 18, borderRadius: 16, gap: 8 },
  title: { color: Colors.primaryDark, fontSize: 16, fontWeight: '700' },
  message: { color: Colors.textSecondary, fontSize: 14, lineHeight: 21 },
})
