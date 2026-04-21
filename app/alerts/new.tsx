import { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useLocation } from '@/lib/useLocation'
import { Colors } from '@/constants/colors'
import type { AlertCategory, AlertSeverity } from '@/types'

const CATEGORIES: { value: AlertCategory; label: string; icon: string }[] = [
  { value: 'injured', label: 'Animal herido', icon: '🤕' },
  { value: 'abandoned', label: 'Abandono', icon: '😢' },
  { value: 'abuse', label: 'Maltrato', icon: '⚠️' },
  { value: 'stray', label: 'Animal callejero', icon: '🐕' },
  { value: 'emergency', label: 'Emergencia', icon: '🚨' },
  { value: 'other', label: 'Otro', icon: '📢' },
]

const SEVERITIES: { level: AlertSeverity; label: string; color: string; desc: string }[] = [
  { level: 1, label: 'Bajo', color: Colors.severity1, desc: 'Sin urgencia inmediata' },
  { level: 2, label: 'Leve', color: Colors.severity2, desc: 'Atención en las próximas horas' },
  { level: 3, label: 'Moderado', color: Colors.severity3, desc: 'Requiere atención pronto' },
  { level: 4, label: 'Grave', color: Colors.severity4, desc: 'Riesgo alto, actuar rápido' },
  { level: 5, label: 'Crítico', color: Colors.severity5, desc: '¡Peligro de vida inmediato!' },
]

export default function NewAlert() {
  const { profile } = useAuthStore()
  const { getLocation, locating } = useLocation()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<AlertCategory>('injured')
  const [severity, setSeverity] = useState<AlertSeverity>(3)
  const [address, setAddress] = useState('')
  const [lat, setLat] = useState(0)
  const [lng, setLng] = useState(0)
  const [loading, setLoading] = useState(false)

  const handleUseLocation = async () => {
    const loc = await getLocation()
    if (loc) {
      setAddress(loc.address)
      setLat(loc.lat)
      setLng(loc.lng)
    }
  }

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim() || !address.trim()) {
      Alert.alert('Campos requeridos', 'Completa título, descripción y ubicación')
      return
    }
    if (!profile) {
      Alert.alert('Error', 'Debes iniciar sesión')
      return
    }

    setLoading(true)
    const { error } = await supabase.from('community_alerts').insert({
      creator_id: profile.id,
      title: title.trim(),
      description: description.trim(),
      category,
      severity,
      address: address.trim(),
      lat,
      lng,
      photos: [],
      status: 'active',
      responses_count: 0,
    })
    setLoading(false)

    if (error) {
      Alert.alert('Error', error.message)
      return
    }

    Alert.alert('¡Alerta publicada!', 'La comunidad y los veterinarios cercanos serán notificados.', [
      { text: 'OK', onPress: () => router.replace('/(tabs)') },
    ])
  }

  const selectedSeverity = SEVERITIES.find((s) => s.level === severity)!

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Nueva Alerta</Text>
        <TouchableOpacity onPress={handleSubmit} disabled={loading}>
          {loading
            ? <ActivityIndicator color={Colors.primary} size="small" />
            : <Text style={styles.publishText}>Publicar</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
      >
        {/* Category */}
        <View style={styles.field}>
          <Text style={styles.label}>Tipo de alerta</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map(({ value, label, icon }) => (
              <TouchableOpacity
                key={value}
                style={[styles.catBtn, category === value && styles.catBtnActive]}
                onPress={() => setCategory(value)}
              >
                <Text style={styles.catIcon}>{icon}</Text>
                <Text style={[styles.catLabel, category === value && styles.catLabelActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Severity */}
        <View style={styles.field}>
          <Text style={styles.label}>Nivel de urgencia</Text>
          <View style={styles.severityRow}>
            {SEVERITIES.map(({ level, label, color }) => (
              <TouchableOpacity
                key={level}
                style={[
                  styles.sevBtn,
                  { borderColor: color },
                  severity === level && { backgroundColor: color },
                ]}
                onPress={() => setSeverity(level)}
              >
                <Text style={[styles.sevLabel, severity === level && { color: Colors.white }]}>
                  {level}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={[styles.severityInfo, { backgroundColor: selectedSeverity.color + '20' }]}>
            <Text style={[styles.severityInfoText, { color: selectedSeverity.color }]}>
              {selectedSeverity.label}: {selectedSeverity.desc}
            </Text>
          </View>
        </View>

        {/* Title */}
        <View style={styles.field}>
          <Text style={styles.label}>Título *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Ej: Perro herido en av. Corrientes"
            placeholderTextColor={Colors.textDisabled}
            maxLength={100}
          />
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.label}>Descripción *</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe la situación con el mayor detalle posible..."
            placeholderTextColor={Colors.textDisabled}
            multiline
            textAlignVertical="top"
            maxLength={500}
          />
          <Text style={styles.charCount}>{description.length}/500</Text>
        </View>

        {/* Address */}
        <View style={styles.field}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Ubicación *</Text>
            <TouchableOpacity
              style={styles.locationBtn}
              onPress={handleUseLocation}
              disabled={locating}
            >
              {locating
                ? <ActivityIndicator size="small" color={Colors.primary} />
                : <Text style={styles.locationBtnText}>📍 Mi ubicación</Text>
              }
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={(text) => {
              setAddress(text)
              // Clear saved coords if user edits manually after using GPS
              if (lat !== 0 || lng !== 0) { setLat(0); setLng(0) }
            }}
            placeholder="Calle y número, barrio o referencia"
            placeholderTextColor={Colors.textDisabled}
          />
          {lat !== 0 && (
            <Text style={styles.coordsHint}>📡 Ubicación GPS guardada</Text>
          )}
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            {severity >= 4
              ? '🚨 Por el nivel de urgencia, se notificará a veterinarios y clínicas cercanas.'
              : '📢 Esta alerta será visible para toda la comunidad.'}
          </Text>
        </View>
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
  publishText: { color: Colors.primary, fontSize: 15, fontWeight: '700' },
  scroll: { flex: 1 },
  inner: { padding: 20, gap: 24 },
  field: { gap: 10 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    minWidth: '30%',
  },
  catBtnActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  catIcon: { fontSize: 18 },
  catLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  catLabelActive: { color: Colors.primaryDark },
  severityRow: { flexDirection: 'row', gap: 8 },
  sevBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 2,
    backgroundColor: Colors.surface,
  },
  sevLabel: { fontSize: 15, fontWeight: '700', color: Colors.textSecondary },
  severityInfo: { borderRadius: 10, padding: 10 },
  severityInfoText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
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
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight,
    minWidth: 44,
    justifyContent: 'center',
  },
  locationBtnText: { fontSize: 12, color: Colors.primaryDark, fontWeight: '600' },
  coordsHint: { fontSize: 11, color: Colors.primary, fontWeight: '500' },
  notice: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    padding: 14,
  },
  noticeText: { fontSize: 13, color: Colors.primaryDark, lineHeight: 18 },
})
