import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Colors } from '@/constants/colors'

const CONFIRM_PHRASE = 'ELIMINAR'

export default function DeleteAccount() {
  const { signOut } = useAuthStore()
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)

  const canDelete = confirmText.trim().toUpperCase() === CONFIRM_PHRASE && !loading

  const handleDelete = async () => {
    setLoading(true)
    const { error } = await supabase.rpc('fn_request_account_deletion')
    if (error) {
      setLoading(false)
      Alert.alert('Error', error.message)
      return
    }
    await signOut()
    router.replace('/(auth)/welcome')
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} disabled={loading}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Eliminar cuenta</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.inner}>
        <View style={styles.banner}>
          <Text style={styles.bannerIcon}>⚠️</Text>
          <Text style={styles.bannerText}>
            Esta acción no se puede deshacer.
          </Text>
        </View>

        <Text style={styles.title}>¿Qué pasa cuando eliminás tu cuenta?</Text>

        <View style={styles.list}>
          <Bullet text="Tu nombre, foto, biografía, teléfono y ubicación se eliminan inmediatamente." />
          <Bullet text="No vas a poder volver a iniciar sesión con esta cuenta." />
          <Bullet text="Las publicaciones, alertas y reportes que creaste seguirán visibles, pero firmados como 'Cuenta eliminada'." />
          <Bullet text="Las adopciones que cerraste y sus contratos de seguimiento se mantienen, para que la otra persona involucrada no los pierda." />
          <Bullet text="No vas a recibir más notificaciones." />
        </View>

        <Text style={styles.label}>
          Para confirmar, escribí <Text style={styles.bold}>{CONFIRM_PHRASE}</Text>:
        </Text>
        <TextInput
          style={styles.input}
          value={confirmText}
          onChangeText={setConfirmText}
          placeholder={CONFIRM_PHRASE}
          placeholderTextColor={Colors.textDisabled}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.deleteBtn, !canDelete && styles.deleteBtnDisabled]}
          onPress={() =>
            Alert.alert(
              '¿Eliminar cuenta?',
              'Esta acción es permanente.',
              [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Eliminar', style: 'destructive', onPress: handleDelete },
              ]
            )
          }
          disabled={!canDelete}
        >
          {loading
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.deleteBtnText}>Eliminar mi cuenta</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} disabled={loading}>
          <Text style={styles.cancelLink}>Cancelar y volver</Text>
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
