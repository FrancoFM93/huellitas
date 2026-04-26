import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { changeLanguage } from '@/lib/i18n'
import i18next from 'i18next'
import { useAuthStore } from '@/store/authStore'
import { Colors } from '@/constants/colors'

export default function Settings() {
  const { t } = useTranslation()
  const { signOut } = useAuthStore()

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Ajustes</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.inner}>
        <Text style={styles.sectionTitle}>Cuenta</Text>
        <Row
          icon="✏️"
          label="Editar perfil"
          onPress={() => router.push('/profile/edit')}
        />
        <Row
          icon="🚪"
          label="Cerrar sesión"
          onPress={signOut}
        />

        <Text style={styles.sectionTitle}>Idioma</Text>
        <View style={styles.langCard}>
          {[
            { code: 'es', label: 'Español' },
            { code: 'en', label: 'English' },
          ].map((l) => (
            <TouchableOpacity
              key={l.code}
              style={[styles.langBtn, i18next.language === l.code && styles.langBtnActive]}
              onPress={() => changeLanguage(l.code as 'es' | 'en')}
            >
              <Text style={[styles.langText, i18next.language === l.code && styles.langTextActive]}>
                {l.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Información</Text>
        <Row
          icon="📄"
          label="Términos y condiciones"
          onPress={() => Linking.openURL('https://huellitas.app/terms')}
        />
        <Row
          icon="🔒"
          label="Política de privacidad"
          onPress={() => Linking.openURL('https://huellitas.app/privacy')}
        />

        <Text style={[styles.sectionTitle, { color: Colors.alert }]}>Zona peligrosa</Text>
        <TouchableOpacity
          style={styles.dangerRow}
          onPress={() => router.push('/profile/delete-account')}
        >
          <Text style={styles.dangerIcon}>🗑️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.dangerLabel}>Eliminar mi cuenta</Text>
            <Text style={styles.dangerHint}>Tu perfil será anonimizado y no podrás iniciar sesión.</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

function Row({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
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
  inner: { padding: 20, gap: 10, paddingBottom: 48 },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', marginTop: 14,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.surface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  rowIcon: { fontSize: 22 },
  rowLabel: { flex: 1, fontSize: 15, color: Colors.text, fontWeight: '500' },
  chevron: { fontSize: 22, color: Colors.textDisabled },
  langCard: {
    flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, padding: 6, gap: 6,
  },
  langBtn: {
    flex: 1, paddingVertical: 11, alignItems: 'center', borderRadius: 8,
  },
  langBtnActive: { backgroundColor: Colors.primary },
  langText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
  langTextActive: { color: Colors.white },
  dangerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.alertLight, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.alert,
  },
  dangerIcon: { fontSize: 22 },
  dangerLabel: { fontSize: 15, color: Colors.alert, fontWeight: '700' },
  dangerHint: { fontSize: 12, color: Colors.alert, marginTop: 2, lineHeight: 16 },
})
