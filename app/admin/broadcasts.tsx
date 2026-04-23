import { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { slugify } from '@/lib/geoSlug'
import { Colors } from '@/constants/colors'
import type { BroadcastScope } from '@/types'

const SCOPES: { value: BroadcastScope; label: string; icon: string }[] = [
  { value: 'city', label: 'Ciudad', icon: '🏙️' },
  { value: 'region', label: 'Región', icon: '🗺️' },
  { value: 'country', label: 'País', icon: '🌎' },
]

export default function AdminBroadcasts() {
  const profile = useAuthStore((s) => s.profile)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [scope, setScope] = useState<BroadcastScope>('country')
  const [country, setCountry] = useState((profile?.country ?? 'CL').toUpperCase())
  const [region, setRegion] = useState(profile?.region ?? '')
  const [city, setCity] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Campos requeridos', 'Completa título y mensaje')
      return
    }
    if (!country.trim()) {
      Alert.alert('Campos requeridos', 'Indica el país (código ISO, ej: CL)')
      return
    }
    if ((scope === 'region' || scope === 'city') && !region.trim()) {
      Alert.alert('Campos requeridos', 'Indica la región')
      return
    }
    if (scope === 'city' && !city.trim()) {
      Alert.alert('Campos requeridos', 'Indica la ciudad')
      return
    }
    if (!profile) {
      Alert.alert('Error', 'Sesión expirada')
      return
    }

    setSaving(true)
    const { error } = await supabase.from('emergency_broadcasts').insert({
      creator_id: profile.id,
      title: title.trim(),
      body: body.trim(),
      scope,
      country: country.trim().toUpperCase(),
      region: scope === 'city' || scope === 'region' ? region.trim() : null,
      city_slug: scope === 'city' ? slugify(city) : null,
    })
    setSaving(false)

    if (error) {
      Alert.alert('Error', error.message)
      return
    }

    Alert.alert('Alerta enviada', 'La difusión se entregó a los perfiles en el alcance indicado.', [
      { text: 'OK', onPress: () => router.back() },
    ])
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Alerta masiva</Text>
        <TouchableOpacity onPress={handleSend} disabled={saving}>
          {saving
            ? <ActivityIndicator color={Colors.alert} size="small" />
            : <Text style={styles.sendText}>Enviar</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            ⚠️ Este mensaje se enviará como notificación a todos los perfiles dentro del alcance. Úsalo solo ante emergencias reales.
          </Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Título *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Ej: Evacuación por incendio en Valparaíso"
            placeholderTextColor={Colors.textDisabled}
            maxLength={100}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Mensaje *</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={body}
            onChangeText={setBody}
            placeholder="Describe la situación y las acciones a tomar..."
            placeholderTextColor={Colors.textDisabled}
            multiline
            textAlignVertical="top"
            maxLength={500}
          />
          <Text style={styles.charCount}>{body.length}/500</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Alcance</Text>
          <View style={styles.scopeRow}>
            {SCOPES.map(({ value, label, icon }) => (
              <TouchableOpacity
                key={value}
                style={[styles.scopeBtn, scope === value && styles.scopeBtnActive]}
                onPress={() => setScope(value)}
              >
                <Text style={styles.scopeIcon}>{icon}</Text>
                <Text style={[styles.scopeLabel, scope === value && styles.scopeLabelActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>País (ISO-2) *</Text>
          <TextInput
            style={styles.input}
            value={country}
            onChangeText={(v) => setCountry(v.toUpperCase())}
            placeholder="CL, AR, PE..."
            placeholderTextColor={Colors.textDisabled}
            maxLength={2}
            autoCapitalize="characters"
          />
        </View>

        {(scope === 'region' || scope === 'city') && (
          <View style={styles.field}>
            <Text style={styles.label}>Región *</Text>
            <TextInput
              style={styles.input}
              value={region}
              onChangeText={setRegion}
              placeholder="Ej: Metropolitana"
              placeholderTextColor={Colors.textDisabled}
            />
          </View>
        )}

        {scope === 'city' && (
          <View style={styles.field}>
            <Text style={styles.label}>Ciudad *</Text>
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholder="Ej: Santiago"
              placeholderTextColor={Colors.textDisabled}
            />
            {!!city && <Text style={styles.hint}>Slug: {slugify(city)}</Text>}
          </View>
        )}

        <TouchableOpacity
          style={[styles.sendBtn, saving && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color={Colors.white} />
            : <Text style={styles.sendBtnText}>🚨 Enviar alerta masiva</Text>}
        </TouchableOpacity>
      </ScrollView>
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
  sendText: { color: Colors.alert, fontSize: 15, fontWeight: '700' },
  scroll: { flex: 1 },
  inner: { padding: 20, gap: 20 },
  warningBanner: {
    backgroundColor: Colors.alertLight,
    borderRadius: 12,
    padding: 14,
  },
  warningText: { fontSize: 13, color: Colors.alert, lineHeight: 18, fontWeight: '500' },
  field: { gap: 10 },
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
  textarea: { minHeight: 100, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: Colors.textDisabled, textAlign: 'right' },
  hint: { fontSize: 11, color: Colors.textMuted, fontStyle: 'italic' },
  scopeRow: { flexDirection: 'row', gap: 8 },
  scopeBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  scopeBtnActive: { backgroundColor: Colors.alertLight, borderColor: Colors.alert },
  scopeIcon: { fontSize: 16 },
  scopeLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  scopeLabelActive: { color: Colors.alert },
  sendBtn: {
    backgroundColor: Colors.alert,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
})
