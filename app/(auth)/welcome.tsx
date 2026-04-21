import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { Colors } from '@/constants/colors'

export default function Welcome() {
  const { t } = useTranslation()

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.paw}>🐾</Text>
        <Text style={styles.title}>{t('auth.welcome_title')}</Text>
        <Text style={styles.subtitle}>{t('auth.welcome_subtitle')}</Text>
      </View>

      <View style={styles.features}>
        <FeatureRow icon="🔍" text={t('auth.feature_missing')} />
        <FeatureRow icon="🚨" text={t('auth.feature_alerts')} />
        <FeatureRow icon="🏥" text={t('auth.feature_vets')} />
        <FeatureRow icon="💰" text={t('auth.feature_funds')} />
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.btnPrimary} onPress={() => router.push('/(auth)/register')}>
          <Text style={styles.btnPrimaryText}>{t('auth.create_account')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.btnSecondaryText}>{t('auth.already_have_account')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

function FeatureRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.featureRow}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: 24 },
  hero: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
  paw: { fontSize: 64, marginBottom: 12 },
  title: { fontSize: 40, fontWeight: '800', color: Colors.primary, letterSpacing: -1 },
  subtitle: {
    fontSize: 16, color: Colors.textSecondary, textAlign: 'center',
    marginTop: 12, lineHeight: 24, paddingHorizontal: 8,
  },
  features: { gap: 16, paddingVertical: 24 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIcon: { fontSize: 24, width: 36, textAlign: 'center' },
  featureText: { flex: 1, fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  actions: { gap: 12, paddingBottom: 16 },
  btnPrimary: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  btnPrimaryText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  btnSecondary: {
    borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.primary,
  },
  btnSecondaryText: { color: Colors.primary, fontSize: 16, fontWeight: '600' },
})
