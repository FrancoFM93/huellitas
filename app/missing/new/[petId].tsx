import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Platform,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Colors } from '@/constants/colors'
import * as Location from 'expo-location'
import type { Pet } from '@/types'

export default function ReportMissing() {
  const { petId } = useLocalSearchParams<{ petId: string }>()
  const { profile } = useAuthStore()

  const [pet, setPet] = useState<Pet | null>(null)
  const [loadingPet, setLoadingPet] = useState(true)

  const [address, setAddress] = useState('')
  const [lat, setLat] = useState(0)
  const [lng, setLng] = useState(0)
  const [lastSeenAt, setLastSeenAt] = useState(new Date())
  const [description, setDescription] = useState('')
  const [locating, setLocating] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from('pets').select('*').eq('id', petId).single()
      if (cancelled) return
      const p = data as Pet | null
      setPet(p)
      if (p && profile && p.owner_id !== profile.id) {
        Alert.alert('Sin permisos', 'Solo el dueño puede reportar a esta mascota.')
        router.back()
        return
      }
      setLoadingPet(false)
    })()
    return () => { cancelled = true }
  }, [petId, profile?.id])

  const useCurrentLocation = async () => {
    setLocating(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Necesitamos acceso a tu ubicación para fijar el último avistamiento.')
        return
      }
      const pos = await Location.getCurrentPositionAsync({})
      setLat(pos.coords.latitude)
      setLng(pos.coords.longitude)
      try {
        const [rev] = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
        const parts = [rev?.street, rev?.city, rev?.region].filter(Boolean)
        if (parts.length > 0 && !address.trim()) setAddress(parts.join(', '))
      } catch {}
    } catch {
      Alert.alert('Error', 'No se pudo obtener tu ubicación actual.')
    } finally {
      setLocating(false)
    }
  }

  const adjustDate = (deltaMinutes: number) => {
    setLastSeenAt((d) => new Date(d.getTime() + deltaMinutes * 60 * 1000))
  }

  const handleSubmit = async () => {
    if (!pet || !profile) return
    if (!address.trim()) {
      Alert.alert('Falta la ubicación', 'Ingresá la zona donde se vio por última vez.')
      return
    }
    if (!description.trim()) {
      Alert.alert('Falta la descripción', 'Contá qué ropa/collar tenía, dirección de fuga, etc.')
      return
    }
    if (lastSeenAt.getTime() > Date.now()) {
      Alert.alert('Fecha inválida', 'La fecha del último avistamiento no puede ser futura.')
      return
    }

    setSaving(true)
    const { error: updErr } = await supabase.from('pets').update({ is_missing: true }).eq('id', petId)
    if (updErr) { setSaving(false); Alert.alert('Error', updErr.message); return }

    const { error } = await supabase.from('missing_pet_reports').insert({
      pet_id: petId,
      reporter_id: profile.id,
      last_seen_lat: lat,
      last_seen_lng: lng,
      last_seen_address: address.trim(),
      last_seen_at: lastSeenAt.toISOString(),
      description: description.trim(),
      status: 'active',
      sightings_count: 0,
    })
    setSaving(false)

    if (error) {
      Alert.alert('Error', error.message)
      return
    }

    Alert.alert(
      'Reporte publicado',
      `Se notificará a la comunidad para ayudar a encontrar a ${pet.name}.`,
      [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]
    )
  }

  if (loadingPet) {
    return <View style={styles.loader}><ActivityIndicator color={Colors.primary} /></View>
  }
  if (!pet) {
    return <SafeAreaView style={styles.container}><Text style={styles.empty}>Mascota no encontrada</Text></SafeAreaView>
  }

  const dateLabel = lastSeenAt.toLocaleDateString()
  const timeLabel = lastSeenAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const locFixed = lat !== 0 || lng !== 0

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Reportar perdida</Text>
        <TouchableOpacity onPress={handleSubmit} disabled={saving}>
          {saving
            ? <ActivityIndicator color={Colors.primary} size="small" />
            : <Text style={styles.publishText}>Publicar</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            🚨 Reportá la última ubicación con la mayor precisión posible. Cada minuto cuenta.
          </Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Mascota</Text>
          <Text style={styles.petName}>{pet.name}</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Última zona vista *</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="Ej: Plaza Italia, Palermo"
            placeholderTextColor={Colors.textDisabled}
            autoCapitalize="words"
          />
          <TouchableOpacity
            style={[styles.locBtn, locating && styles.locBtnDisabled]}
            onPress={useCurrentLocation}
            disabled={locating}
          >
            {locating
              ? <ActivityIndicator color={Colors.primary} />
              : <Text style={styles.locBtnText}>
                  {locFixed ? '📍 Ubicación fijada · cambiar' : '📍 Usar mi ubicación actual'}
                </Text>}
          </TouchableOpacity>
          {locFixed && (
            <Text style={styles.coords}>
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </Text>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Cuándo se vio por última vez</Text>
          <View style={styles.timeRow}>
            <View style={styles.timeChip}>
              <Text style={styles.timeChipLabel}>Fecha</Text>
              <Text style={styles.timeChipValue}>{dateLabel}</Text>
            </View>
            <View style={styles.timeChip}>
              <Text style={styles.timeChipLabel}>Hora</Text>
              <Text style={styles.timeChipValue}>{timeLabel}</Text>
            </View>
          </View>
          <View style={styles.adjustRow}>
            <AdjustBtn label="−1 día"  onPress={() => adjustDate(-60 * 24)} />
            <AdjustBtn label="−1 hora" onPress={() => adjustDate(-60)} />
            <AdjustBtn label="−15 min" onPress={() => adjustDate(-15)} />
            <AdjustBtn label="ahora"   onPress={() => setLastSeenAt(new Date())} />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Descripción *</Text>
          <Text style={styles.hint}>
            Collar, ropa, dirección en la que escapó, comportamiento (asustado, sociable), número de contacto.
          </Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder={`${pet.name} se escapó... `}
            placeholderTextColor={Colors.textDisabled}
            multiline
            textAlignVertical="top"
            maxLength={800}
          />
          <Text style={styles.charCount}>{description.length}/800</Text>
        </View>

        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>Consejos rápidos</Text>
          <Text style={styles.tip}>• Mostrá las fotos del perfil de la mascota — ya están en el reporte.</Text>
          <Text style={styles.tip}>• Avisá a vecinos, veterinarias y refugios cercanos.</Text>
          <Text style={styles.tip}>• Si lo/la encontrás, marcalo/a como "encontrado" para limpiar el aviso.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function AdjustBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.adjustBtn} onPress={onPress}>
      <Text style={styles.adjustBtnText}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  empty: { textAlign: 'center', marginTop: 40, color: Colors.textMuted, fontStyle: 'italic' },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  cancelText: { color: Colors.textSecondary, fontSize: 15 },
  topBarTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  publishText: { color: Colors.alert, fontSize: 15, fontWeight: '700' },
  inner: { padding: 20, gap: 22, paddingBottom: 48 },
  banner: { backgroundColor: Colors.alertLight, borderRadius: 12, padding: 14 },
  bannerText: { fontSize: 13, color: Colors.alert, fontWeight: '600', lineHeight: 19 },
  field: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text },
  hint: { fontSize: 12, color: Colors.textMuted, lineHeight: 17 },
  petName: { fontSize: 18, fontWeight: '800', color: Colors.text },
  input: {
    backgroundColor: Colors.surface, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 15, color: Colors.text,
  },
  textarea: { minHeight: 100, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: Colors.textDisabled, textAlign: 'right' },
  locBtn: {
    backgroundColor: Colors.primaryLight, borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  locBtnDisabled: { opacity: 0.6 },
  locBtnText: { color: Colors.primaryDark, fontSize: 13, fontWeight: '700' },
  coords: { fontSize: 11, color: Colors.textMuted, textAlign: 'center' },
  timeRow: { flexDirection: 'row', gap: 10 },
  timeChip: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  timeChipLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  timeChipValue: { fontSize: 15, fontWeight: '700', color: Colors.text, marginTop: 2 },
  adjustRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  adjustBtn: {
    backgroundColor: Colors.borderLight, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7,
  },
  adjustBtnText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  tipsCard: {
    backgroundColor: Colors.infoLight, borderRadius: 12, padding: 14, gap: 4,
  },
  tipsTitle: { fontSize: 13, fontWeight: '700', color: Colors.info },
  tip: { fontSize: 12, color: Colors.info, lineHeight: 18 },
})
