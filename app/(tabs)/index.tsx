import { useState, useCallback, useEffect } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { Colors } from '@/constants/colors'
import type { CommunityAlert, MissingPetReport } from '@/types'

type FeedItem =
  | { _type: 'alert'; data: CommunityAlert }
  | { _type: 'missing'; data: MissingPetReport }

const SEVERITY_LABELS: Record<number, string> = {
  1: 'Bajo', 2: 'Leve', 3: 'Moderado', 4: 'Grave', 5: 'Crítico',
}

const SEVERITY_COLORS: Record<number, string> = {
  1: Colors.severity1,
  2: Colors.severity2,
  3: Colors.severity3,
  4: Colors.severity4,
  5: Colors.severity5,
}

const CATEGORY_ICONS: Record<string, string> = {
  injured: '🤕', abandoned: '😢', abuse: '⚠️',
  stray: '🐕', emergency: '🚨', other: '📢',
}

const SPECIES_ICONS: Record<string, string> = {
  dog: '🐶', cat: '🐱', bird: '🐦', rabbit: '🐰', other: '🐾',
}

async function fetchFeed(): Promise<FeedItem[]> {
  const [alertsRes, missingRes] = await Promise.all([
    supabase
      .from('community_alerts')
      .select('*, creator:profiles(id,name,avatar_url,type)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('missing_pet_reports')
      .select('*, pet:pets(*), reporter:profiles(id,name,avatar_url,type)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const alerts: FeedItem[] = (alertsRes.data ?? []).map((a) => ({ _type: 'alert', data: a }))
  const missing: FeedItem[] = (missingRes.data ?? []).map((m) => ({ _type: 'missing', data: m }))

  return [...alerts, ...missing].sort((a, b) => {
    const dateA = a._type === 'alert' ? a.data.created_at : a.data.created_at
    const dateB = b._type === 'alert' ? b.data.created_at : b.data.created_at
    return new Date(dateB).getTime() - new Date(dateA).getTime()
  })
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'ahora'
  if (m < 60) return `hace ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h}h`
  return `hace ${Math.floor(h / 24)}d`
}

function AlertCard({ item }: { item: CommunityAlert }) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/alerts/${item.id}`)}
      activeOpacity={0.8}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.severityBadge, { backgroundColor: SEVERITY_COLORS[item.severity] + '25' }]}>
          <View style={[styles.severityDot, { backgroundColor: SEVERITY_COLORS[item.severity] }]} />
          <Text style={[styles.severityText, { color: SEVERITY_COLORS[item.severity] }]}>
            {SEVERITY_LABELS[item.severity]}
          </Text>
        </View>
        <Text style={styles.timeText}>{timeAgo(item.created_at)}</Text>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardIcon}>{CATEGORY_ICONS[item.category] ?? '📢'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
          {item.address && (
            <Text style={styles.cardLocation} numberOfLines={1}>📍 {item.address}</Text>
          )}
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.cardAuthor}>
          {item.creator?.name ?? 'Anónimo'}
        </Text>
        {item.responses_count > 0 && (
          <Text style={styles.responsesText}>
            {item.responses_count} {item.responses_count === 1 ? 'respuesta' : 'respuestas'}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  )
}

function MissingCard({ item }: { item: MissingPetReport }) {
  const icon = SPECIES_ICONS[item.pet?.species ?? 'other']
  return (
    <TouchableOpacity
      style={[styles.card, styles.missingCard]}
      onPress={() => router.push(`/missing/${item.id}`)}
      activeOpacity={0.8}
    >
      <View style={styles.cardHeader}>
        <View style={styles.missingBadge}>
          <Text style={styles.missingBadgeText}>🔍 MASCOTA PERDIDA</Text>
        </View>
        <Text style={styles.timeText}>{timeAgo(item.created_at)}</Text>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardIcon}>{icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{item.pet?.name ?? 'Mascota perdida'}</Text>
          <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
          {item.last_seen_address && (
            <Text style={styles.cardLocation} numberOfLines={1}>
              📍 Última vez vista: {item.last_seen_address}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.cardAuthor}>{item.reporter?.name ?? 'Anónimo'}</Text>
        <Text style={styles.responsesText}>
          {item.sightings_count} {item.sightings_count === 1 ? 'avistamiento' : 'avistamientos'}
        </Text>
      </View>
    </TouchableOpacity>
  )
}

export default function Feed() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['feed'],
    queryFn: fetchFeed,
  })
  const [refreshing, setRefreshing] = useState(false)

  // Realtime: invalidate the feed query whenever a new alert or missing report is posted
  useEffect(() => {
    const channel = supabase
      .channel('feed-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_alerts' }, () => {
        qc.invalidateQueries({ queryKey: ['feed'] })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'missing_pet_reports' }, () => {
        qc.invalidateQueries({ queryKey: ['feed'] })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('feed.title')}</Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => router.push('/alerts/new')}
        >
          <Text style={styles.createBtnText}>{t('feed.report')}</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => `${item._type}-${item.data.id}`}
          renderItem={({ item }) =>
            item._type === 'alert'
              ? <AlertCard item={item.data} />
              : <MissingCard item={item.data} />
          }
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🌟</Text>
              <Text style={styles.emptyTitle}>{t('feed.empty_title')}</Text>
              <Text style={styles.emptyText}>{t('feed.empty_text')}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.primary },
  createBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  createBtnText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  missingCard: {
    borderColor: Colors.warning + '40',
    borderWidth: 1.5,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  severityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 5,
  },
  severityDot: { width: 6, height: 6, borderRadius: 3 },
  severityText: { fontSize: 11, fontWeight: '700' },
  missingBadge: {
    backgroundColor: Colors.warningLight,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  missingBadgeText: { color: Colors.warning, fontSize: 11, fontWeight: '700' },
  timeText: { color: Colors.textMuted, fontSize: 12 },
  cardBody: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  cardIcon: { fontSize: 32, marginTop: 2 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, lineHeight: 20 },
  cardDesc: { fontSize: 13, color: Colors.textSecondary, marginTop: 3, lineHeight: 18 },
  cardLocation: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardAuthor: { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },
  responsesText: { fontSize: 12, color: Colors.primary, fontWeight: '500' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: 14, color: Colors.textMuted, marginTop: 4 },
})
