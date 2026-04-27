import { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Colors } from '@/constants/colors'

export default function ApplyScreen() {
  const { t } = useTranslation()
  const { postId } = useLocalSearchParams<{ postId: string }>()
  const { profile } = useAuthStore()
  const [message, setMessage] = useState('')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!message.trim()) {
      Alert.alert(t('adoption.apply_required_title'), t('adoption.apply_required_msg'))
      return
    }
    if (!profile) return

    setSaving(true)
    const { error } = await supabase.from('adoption_applications').insert({
      post_id: postId,
      applicant_id: profile.id,
      message: message.trim(),
      contact_phone: phone.trim() || null,
    })
    setSaving(false)

    if (error) {
      Alert.alert(t('common.error'), error.message)
      return
    }

    Alert.alert(t('adoption.apply_sent_title'), t('adoption.apply_sent_msg'), [
      { text: 'OK', onPress: () => router.back() },
    ])
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>{t('adoption.apply_title')}</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
          <Text style={styles.helper}>{t('adoption.apply_helper')}</Text>

          <View style={styles.field}>
            <Text style={styles.label}>{t('adoption.apply_message')}</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={message}
              onChangeText={setMessage}
              placeholder={t('adoption.apply_message_placeholder')}
              placeholderTextColor={Colors.textDisabled}
              multiline
              textAlignVertical="top"
              maxLength={600}
            />
            <Text style={styles.charCount}>{message.length}/600</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('adoption.apply_phone')}</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder={t('adoption.apply_phone_placeholder')}
              placeholderTextColor={Colors.textDisabled}
              keyboardType="phone-pad"
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.submitBtnText}>{t('adoption.apply_send')}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cancelText: { color: Colors.textSecondary, fontSize: 15 },
  topBarTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  inner: { padding: 20, gap: 18 },
  helper: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  field: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.text,
  },
  textarea: { minHeight: 130, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: Colors.textDisabled, textAlign: 'right' },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
})
