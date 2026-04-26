import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Colors } from '@/constants/colors'

export default function DeleteAccount() {
  const { t } = useTranslation()
  const { signOut } = useAuthStore()
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)

  const phrase = t('profile.delete_confirm_phrase')
  const canDelete = confirmText.trim().toUpperCase() === phrase && !loading

  const handleDelete = async () => {
    setLoading(true)
    const { error } = await supabase.rpc('fn_request_account_deletion')
    if (error) {
      setLoading(false)
      Alert.alert(t('common.error'), error.message)
      return
    }
    await signOut()
    router.replace('/(auth)/welcome')
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} disabled={loading}>
          <Text style={styles.backText}>{t('profile.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{t('profile.delete_title')}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.inner}>
        <View style={styles.banner}>
          <Text style={styles.bannerIcon}>⚠️</Text>
          <Text style={styles.bannerText}>{t('profile.delete_warning')}</Text>
        </View>

        <Text style={styles.title}>{t('profile.delete_explain')}</Text>

        <View style={styles.list}>
          <Bullet text={t('profile.delete_b1')} />
          <Bullet text={t('profile.delete_b2')} />
          <Bullet text={t('profile.delete_b3')} />
          <Bullet text={t('profile.delete_b4')} />
          <Bullet text={t('profile.delete_b5')} />
        </View>

        <Text style={styles.label}>
          {t('profile.delete_confirm_label')} <Text style={styles.bold}>{phrase}</Text>:
        </Text>
        <TextInput
          style={styles.input}
          value={confirmText}
          onChangeText={setConfirmText}
          placeholder={phrase}
          placeholderTextColor={Colors.textDisabled}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.deleteBtn, !canDelete && styles.deleteBtnDisabled]}
          onPress={() =>
            Alert.alert(
              t('profile.delete_alert_title'),
              t('profile.delete_alert_body'),
              [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('common.delete'), style: 'destructive', onPress: handleDelete },
              ]
            )
          }
          disabled={!canDelete}
        >
          {loading
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.deleteBtnText}>{t('profile.delete_button')}</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} disabled={loading}>
          <Text style={styles.cancelLink}>{t('profile.delete_cancel')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backText: { color: Colors.primary, fontSize: 15, fontWeight: '500' },
  topBarTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  inner: { padding: 20, gap: 18, paddingBottom: 48 },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.alertLight, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.alert,
  },
  bannerIcon: { fontSize: 26 },
  bannerText: { flex: 1, color: Colors.alert, fontSize: 14, fontWeight: '700', lineHeight: 19 },
  title: { fontSize: 17, fontWeight: '700', color: Colors.text },
  list: { gap: 10 },
  bulletRow: { flexDirection: 'row', gap: 8 },
  bulletDot: { color: Colors.text, fontSize: 14, lineHeight: 19 },
  bulletText: { flex: 1, fontSize: 14, color: Colors.textSecondary, lineHeight: 19 },
  label: { fontSize: 14, color: Colors.text, marginTop: 8 },
  bold: { fontWeight: '800' },
  input: {
    backgroundColor: Colors.surface, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: Colors.text,
    letterSpacing: 1.5,
  },
  deleteBtn: {
    backgroundColor: Colors.alert, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  deleteBtnDisabled: { backgroundColor: Colors.textDisabled },
  deleteBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  cancelLink: { textAlign: 'center', color: Colors.primary, fontSize: 14, fontWeight: '600', paddingVertical: 12 },
})
