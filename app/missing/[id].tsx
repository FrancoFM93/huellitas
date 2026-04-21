import { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useLocation } from '@/lib/useLocation'
import { Colors } from '@/constants/colors'
import type { MissingPetReport, PetSighting } from '@/types'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'ahora'
  if (m < 60) return `hace ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h}h`
  return `hace ${Math.floor(h / 24)}d`
}

export default function MissingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { profile } = useAuthStore()
  const qc = useQueryClient()
  const { getLocation, locating } = useLocation()
  const [sightingAddress, setSightingAddress] = useState('')
  const [sightingNotes, setSightingNotes] = useState('')
  const [sightingLat, setSightingLat] = useState(0)
  const [sightingLng, setSightingLng] = useState(0)

  const handleUseSightingLocation = async () => {
    const loc = await getLocation()
    if (loc) {
      setSightingAddress(loc.address)
      setSightingLat(loc.lat)
      setSightingLng(loc.lng)
    }
  }

  const { data: report, isLoading } = useQuery({
    queryKey: ['missing', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('missing_pet_reports')
        .select('*, pet:pets(*), reporter:profiles(id,name)')
        .eq('id', id)
        .single()
      return data as MissingPetReport
    },
  })

  const { data: sightings } = useQuery({
    queryKey: ['sightings', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('pet_sightings')
        .select('*, reporter:profiles(id,name)')
        .eq('report_id', id)
        .order('created_at', { ascending: false })
      return (data ?? []) as PetSighting[]
    },
  })

  const reportSightingMutation = useMutation({
    mutationFn: async () => {
      if (!profile || !sightingAddress.trim()) throw new Error('Ingresa la ubicación del avistamiento')
      const { error } = await supabase.from('pet_sightings').insert({
        report_id: id,
        reporter_id: profile.id,
        lat: sightingLat,
        lng: sightingLng,
        address: sightingAddress.trim(),
        notes: sightingNotes.trim(),
        photo_url: null,
      })
      if (error) throw error
      await supabase
        .from('missing_pet_reports')
        .update({ sightings_count: (report?.sightings_count ?? 0) + 1 })
        .eq('id', id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sightings', id] })
      qc.invalidateQueries({ queryKey: ['missing', id] })
      setSightingAddress('')
      setSightingNotes('')
      setSightingLat(0)
      setSightingLng(0)
      Alert.alert('¡Gracias!', 'Tu avistamiento fue reportado. El dueño será notificado.')
    },
    onError: (e: Error) => Alert.alert('Error', e.message),
  })

  if (isLoading || !report) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    )
  }

  const pet = report.pet as any

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <View style={styles.missingBadge}>
          <Text style={styles.missingBadgeText}>🔍 PERDIDO/A</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.petIcon}>{
            pet?.species === 'dog' ? '🐶' : pet?.species === 'cat' ? '🐱' :
            pet?.species === 'bird' ? '🐦' : pet?.species === 'rabbit' ? '🐰' : '🐾'
          }</Text>
          <View>
            <Text style={styles.petName}>{pet?.name ?? 'Mascota perdida'}</Text>
            <Text style={styles.petDesc}>{pet?.breed ?? pet?.species} · {pet?.color}</Text>
          </View>
        </View>

        {/* Description */}
        <View style={styles.descCard}>
          <Text style={styles.descLabel}>Descripción</Text>
          <Text style={styles.desc}>{report.description}</Text>
        </View>

        {/* Last seen info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Última vez vista</Text>
          <Text style={styles.infoValue}>📍 {report.last_seen_address}</Text>
          <Text style={styles.infoMeta}>{timeAgo(report.last_seen_at)}</Text>
        </View>

        {/* Map */}
        {report.last_seen_lat !== 0 && report.last_seen_lng !== 0 && (
          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              provider={PROVIDER_DEFAULT}
              initialRegion={{
                latitude: report.last_seen_lat,
                longitude: report.last_seen_lng,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
            >
              <Marker coordinate={{ latitude: report.last_seen_lat, longitude: report.last_seen_lng }}>
                <Text style={{ fontSize: 28 }}>
                  {pet?.species === 'dog' ? '🐶' : pet?.species === 'cat' ? '🐱' : '🐾'}
                </Text>
              </Marker>
            </MapView>
          </View>
        )}

        {/* Sightings */}
        <Text style={styles.sectionTitle}>
          Avistamientos ({report.sightings_count})
        </Text>

        {(sightings?.length ?? 0) === 0 ? (
          <Text style={styles.noSightings}>Sin avistamientos aún. ¡Sé el primero en ayudar!</Text>
        ) : (
          <View style={styles.sightingsList}>
            {(sightings ?? []).map((s) => (
              <View key={s.id} style={styles.sightingItem}>
                <View style={styles.sightingHeader}>
                  <Text style={styles.sightingAuthor}>{s.reporter?.name ?? 'Anónimo'}</Text>
                  <Text style={styles.sightingTime}>{timeAgo(s.created_at)}</Text>
                </View>
                <Text style={styles.sightingLocation}>📍 {s.address}</Text>
                {s.notes && <Text style={styles.sightingNotes}>{s.notes}</Text>}
              </View>
            ))}
          </View>
        )}

        {/* Report sighting form */}
        {report.status === 'active' && (
          <View style={styles.sightingForm}>
            <Text style={styles.formTitle}>¿Lo/La viste? Reporta un avistamiento</Text>

            <View style={styles.locationRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={sightingAddress}
                onChangeText={(text) => {
                  setSightingAddress(text)
                  if (sightingLat !== 0) { setSightingLat(0); setSightingLng(0) }
                }}
                placeholder="¿Dónde lo/la viste? (calle, barrio...)"
                placeholderTextColor={Colors.textDisabled}
              />
              <TouchableOpacity
                style={styles.locationBtn}
                onPress={handleUseSightingLocation}
                disabled={locating}
              >
                {locating
                  ? <ActivityIndicator size="small" color={Colors.primary} />
                  : <Text style={styles.locationBtnText}>📍</Text>
                }
              </TouchableOpacity>
            </View>
            {sightingLat !== 0 && (
              <Text style={styles.coordsHint}>📡 Ubicación GPS guardada</Text>
            )}
            <TextInput
              style={[styles.input, styles.textarea]}
              value={sightingNotes}
              onChangeText={setSightingNotes}
              placeholder="Detalles adicionales (estado, dirección que tomó...)"
              placeholderTextColor={Colors.textDisabled}
              multiline
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.reportBtn, !sightingAddress.trim() && { opacity: 0.4 }]}
              onPress={() => reportSightingMutation.mutate()}
              disabled={!sightingAddress.trim() || reportSightingMutation.isPending}
            >
              {reportSightingMutation.isPending
                ? <ActivityIndicator color={Colors.white} size="small" />
                : <Text style={styles.reportBtnText}>📍 Reportar avistamiento</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {report.status === 'found' && (
          <View style={styles.foundBanner}>
            <Text style={styles.foundBannerText}>🎉 ¡Esta mascota ya fue encontrada!</Text>
          </View>
        )}
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
  backText: { color: Colors.primary, fontSize: 15, fontWeight: '500' },
  missingBadge: { backgroundColor: Colors.warningLight, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5 },
  missingBadgeText: { color: Colors.warning, fontSize: 12, fontWeight: '800' },
  inner: { padding: 20, gap: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  petIcon: { fontSize: 56 },
  petName: { fontSize: 24, fontWeight: '800', color: Colors.text },
  petDesc: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  descCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, gap: 8, borderWidth: 1, borderColor: Colors.border },
  descLabel: { fontSize: 12, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  desc: { fontSize: 14, color: Colors.text, lineHeight: 22 },
  infoCard: { backgroundColor: Colors.warningLight, borderRadius: 14, padding: 16, gap: 4 },
  infoTitle: { fontSize: 12, color: Colors.warning, fontWeight: '700', textTransform: 'uppercase' },
  infoValue: { fontSize: 14, color: Colors.text, fontWeight: '600' },
  infoMeta: { fontSize: 12, color: Colors.textMuted },
  mapContainer: { borderRadius: 14, overflow: 'hidden', height: 160, borderWidth: 1, borderColor: Colors.border },
  map: { flex: 1 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  noSightings: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', paddingVertical: 12 },
  sightingsList: { gap: 8 },
  sightingItem: { backgroundColor: Colors.surface, borderRadius: 12, padding: 14, gap: 4, borderWidth: 1, borderColor: Colors.border },
  sightingHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  sightingAuthor: { fontSize: 13, fontWeight: '600', color: Colors.text },
  sightingTime: { fontSize: 12, color: Colors.textMuted },
  sightingLocation: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  sightingNotes: { fontSize: 13, color: Colors.textMuted },
  sightingForm: { gap: 12, backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border },
  formTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.text,
  },
  textarea: { minHeight: 70, textAlignVertical: 'top' },
  locationRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  locationBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary + '40',
  },
  locationBtnText: { fontSize: 20 },
  coordsHint: { fontSize: 11, color: Colors.primary, fontWeight: '500' },
  reportBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  reportBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  foundBanner: { backgroundColor: Colors.successLight, borderRadius: 14, padding: 16, alignItems: 'center' },
  foundBannerText: { color: Colors.success, fontSize: 15, fontWeight: '700' },
})
