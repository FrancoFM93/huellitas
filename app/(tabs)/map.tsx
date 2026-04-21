import { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import MapView, { Marker, Callout, PROVIDER_DEFAULT } from 'react-native-maps'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { Colors } from '@/constants/colors'
import type { CommunityAlert, MissingPetReport } from '@/types'

const SEVERITY_COLORS: Record<number, string> = {
  1: Colors.severity1, 2: Colors.severity2, 3: Colors.severity3,
  4: Colors.severity4, 5: Colors.severity5,
}

type FilterType = 'all' | 'alerts' | 'missing'

async function fetchMapData() {
  const [alertsRes, missingRes] = await Promise.all([
    supabase
      .from('community_alerts')
      .select('id,title,category,severity,lat,lng,address,status')
      .eq('status', 'active'),
    supabase
      .from('missing_pet_reports')
      .select('id,description,last_seen_lat,last_seen_lng,last_seen_address,status,pet:pets(name,species)')
      .eq('status', 'active'),
  ])
  return {
    alerts: (alertsRes.data ?? []) as CommunityAlert[],
    missing: (missingRes.data ?? []) as MissingPetReport[],
  }
}

const SPECIES_ICONS: Record<string, string> = {
  dog: '🐶', cat: '🐱', bird: '🐦', rabbit: '🐰', other: '🐾',
}

const CATEGORY_ICONS: Record<string, string> = {
  injured: '🤕', abandoned: '😢', abuse: '⚠️',
  stray: '🐕', emergency: '🚨', other: '📢',
}

export default function MapScreen() {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<FilterType>('all')
  const { data } = useQuery({ queryKey: ['map-data'], queryFn: fetchMapData })

  const alerts = data?.alerts ?? []
  const missing = data?.missing ?? []

  const showAlerts = filter !== 'missing'
  const showMissing = filter !== 'alerts'

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('map.title')}</Text>
        <View style={styles.filters}>
          {(['all', 'alerts', 'missing'] as FilterType[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f === 'all' ? t('map.filter_all') : f === 'alerts' ? t('map.filter_alerts') : t('map.filter_missing')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <MapView
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          latitude: -34.6037,
          longitude: -58.3816,
          latitudeDelta: 0.15,
          longitudeDelta: 0.15,
        }}
        showsUserLocation
        showsMyLocationButton
      >
        {showAlerts && alerts.map((alert) => (
          <Marker
            key={`alert-${alert.id}`}
            coordinate={{ latitude: alert.lat, longitude: alert.lng }}
            onCalloutPress={() => router.push(`/alerts/${alert.id}`)}
          >
            <View style={[styles.markerAlert, { borderColor: SEVERITY_COLORS[alert.severity] }]}>
              <Text style={styles.markerText}>{CATEGORY_ICONS[alert.category] ?? '📢'}</Text>
            </View>
            <Callout tooltip>
              <View style={styles.callout}>
                <Text style={styles.calloutTitle} numberOfLines={2}>{alert.title}</Text>
                <Text style={styles.calloutSub}>{alert.address}</Text>
                <Text style={styles.calloutLink}>{t('map.see_detail')}</Text>
              </View>
            </Callout>
          </Marker>
        ))}

        {showMissing && missing.map((report) => (
          <Marker
            key={`missing-${report.id}`}
            coordinate={{ latitude: report.last_seen_lat, longitude: report.last_seen_lng }}
            onCalloutPress={() => router.push(`/missing/${report.id}`)}
          >
            <View style={styles.markerMissing}>
              <Text style={styles.markerText}>
                {SPECIES_ICONS[(report.pet as any)?.species ?? 'other']}
              </Text>
            </View>
            <Callout tooltip>
              <View style={styles.callout}>
                <Text style={styles.calloutTitle}>🔍 {(report.pet as any)?.name ?? 'Mascota perdida'}</Text>
                <Text style={styles.calloutSub}>{report.last_seen_address}</Text>
                <Text style={styles.calloutLink}>{t('map.see_sightings')}</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.alert }]} />
          <Text style={styles.legendText}>{t('map.legend_alerts', { count: alerts.length })}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.warning }]} />
          <Text style={styles.legendText}>{t('map.legend_missing', { count: missing.length })}</Text>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
  },
  title: { fontSize: 20, fontWeight: '800', color: Colors.text },
  filters: { flexDirection: 'row', gap: 8 },
  filterBtn: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  filterTextActive: { color: Colors.white, fontWeight: '700' },
  map: { flex: 1 },
  markerAlert: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  markerMissing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.warningLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: Colors.warning,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  markerText: { fontSize: 20 },
  callout: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    width: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  calloutTitle: { fontSize: 13, fontWeight: '700', color: Colors.text },
  calloutSub: { fontSize: 11, color: Colors.textMuted, marginTop: 3 },
  calloutLink: { fontSize: 12, color: Colors.primary, fontWeight: '600', marginTop: 6 },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    padding: 12,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: Colors.textSecondary },
})
