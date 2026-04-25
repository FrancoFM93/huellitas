import { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Colors } from '@/constants/colors'

export default function ApplyScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>()
  const { profile } = useAuthStore()
  const [message, setMessage] = useState('')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!message.trim()) {
      Alert.alert('Campo requerido', 'Escribe un mensaje para el dueño')
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
      Alert.alert('Error', error.message)
      return
    }

    Alert.alert('¡Solicitud enviada!', 'El dueño revisará tu mensaje pronto.', [
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
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Solicitar adopción</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
          <Text style={styles.helper}>
            Cuéntale al dueño sobre ti: con quién vives, qué experiencia tienes con mascotas,
            por qué quieres adoptarlo/a.
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>Mensaje *</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={message}
              onChangeText={setMessage}
              placeholder="Hola, me gustaría adoptar..."
              placeholderTextColor={Colors.textDisabled}
              multiline
              textAlignVertical="top"
              maxLength={600}
            />
            <Text style={styles.charCount}>{message.length}/600</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Teléfono de contacto</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+54 9 11 ..."
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
              : <Text style={styles.submitBtnText}>Enviar solicitud</Text>}
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
