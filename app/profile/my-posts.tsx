import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native'
import { useState, useCallback, useEffect } from 'react'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Colors } from '@/constants/colors'

export default function MyPosts() {
  const { t } = useTranslation()
  const { profile } = useAuthStore()
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    supabase.rpc('fn_mark_missed_sessions').then(() => {})
  }, [])

  const postsQuery = useQuery({
    queryKey: ['my-posts', profile?.id],
    queryFn: async () => {
      const { data: posts } = await supabase
        .from('adoption_posts')
        .select('id,name,species,status,created_at')
        .eq('poster_id', profile!.id)
        .order('created_at', { ascending: false })

      const ids = (posts ?? []).map((p) => p.id)
      if (ids.length === 0) return []

      const { data: apps } = await supabase
        .from('adoption_applications')
        .select('post_id,status')
        .in('post_id', ids)

      const pendingByPost: Record<string, number> = {}
      ;(apps ?? []).forEach((a) => {
        if (a.status === 'pending') pendingByPost[a.post_id] = (pendingByPost[a.post_id] ?? 0) + 1
      })

      return (posts ?? []).map((p) => ({ ...p, pending: pendingByPost[p.id] ?? 0 }))
    },
    enabled: !!profile,
  })

  const contractsQuery = useQuery({
    queryKey: ['my-poster-contracts', profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('adoption_contracts')
        .select('*, post:adoption_posts(name,species), adopter:profiles!adopter_id(name)')
        .eq('poster_id', profile!.id)
        .order('signed_at', { ascending: false })
      return data ?? []
    },
    enabled: !!profile,
  })

  const upcomingQuery = useQuery({
    queryKey: ['my-poster-upcoming', profile?.id],
    queryFn: async () => {
      const { data: contracts } = await supabase
        .from('adoption_contracts')
        .select('id, post:adoption_posts(name)')
        .eq('poster_id', profile!.id)
      const ids = (contracts ?? []).map((c) => c.id)
      if (ids.length === 0) return []

      const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data: sessions } = await supabase
        .from('monitoring_sessions')
        .select('id,contract_id,scheduled_at,type,status,photo_urls,jitsi_room')
        .in('contract_id', ids)
        .eq('status', 'scheduled')
        .lte('scheduled_at', in30)
        .order('scheduled_at', { ascending: true })

      const postByContract: Record<string, string> = {}
      ;(contracts ?? []).forEach((c: any) => { postByContract[c.id] = c.post?.name ?? 'Mascota' })
      return (sessions ?? []).map((s) => ({ ...s, postName: postByContract[s.contract_id] }))
    },
    enabled: !!profile,
  })

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([postsQuery.refetch(), contractsQuery.refetch(), upcomingQuery.refetch()])
    setRefreshing(false)
  }, [postsQuery, contractsQuery, upcomingQuery])

  const posts = postsQuery.data ?? []
  const contracts = contractsQuery.data ?? []
  const upcoming = upcomingQuery.data ?? []
  const loading = postsQuery.isLoading || contractsQuery.isLoading || upcomingQuery.isLoading
  const totalPending = posts.reduce((sum, p: any) => sum + (p.pending ?? 0), 0)

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>{t('profile.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{t('profile.my_posts')}</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={styles.loader}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.inner}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        >
          {totalPending > 0 && (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>📬 {t('profile.my_posts_pending_banner', { count: totalPending })}</Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>{t('profile.my_posts_upcoming')}</Text>
          {upcoming.length === 0 ? (
            <Text style={styles.empty}>{t('profile.my_posts_upcoming_empty')}</Text>
          ) : upcoming.map((s: any) => {
            const ready = (s.photo_urls?.length > 0) || !!s.jitsi_room
            return (
              <TouchableOpacity
                key={s.id}
                style={styles.row}
                onPress={() => router.push(`/monitoring/${s.id}`)}
              >
                <Text style={styles.sessionIcon}>{s.type === 'photo' ? '📷' : '🎥'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{s.postName}</Text>
                  <Text style={styles.rowMeta}>{new Date(s.scheduled_at).toLocaleDateString()}</Text>
                  {ready && <Text style={styles.rowAction}>{t('profile.my_posts_ready_to_verify')}</Text>}
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            )
          })}

          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>{t('profile.my_posts_section')}</Text>
          {posts.length === 0 ? (
            <Text style={styles.empty}>{t('profile.my_posts_empty')}</Text>
          ) : posts.map((p: any) => (
            <TouchableOpacity
              key={p.id}
              style={styles.row}
              onPress={() => router.push(`/adoption/${p.id}`)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{p.name}</Text>
                <Text style={styles.rowMeta}>
                  {p.species === 'dog' ? '🐶' : p.species === 'cat' ? '🐱' : '🐾'} ·{' '}
                  {p.status === 'available' ? 'Disponible' : p.status === 'adopted' ? 'Adoptado' : p.status}
                </Text>
                {p.pending > 0 && (
                  <Text style={styles.badge}>📬 {p.pending} solicitud{p.pending !== 1 ? 'es' : ''}</Text>
                )}
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}

          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>{t('profile.my_posts_contracts')}</Text>
          {contracts.length === 0 ? (
            <Text style={styles.empty}>{t('profile.my_posts_contracts_empty')}</Text>
          ) : contracts.map((c: any) => (
            <TouchableOpacity
              key={c.id}
              style={styles.row}
              onPress={() => router.push(`/adoption/contract/${c.id}`)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{c.post?.name ?? 'Mascota'}</Text>
                <Text style={styles.rowMeta}>Adoptante: {c.adopter?.name ?? '—'}</Text>
                <Text style={[styles.rowStatus, { color: c.status === 'active' ? Colors.success : Colors.textMuted }]}>
                  {c.status === 'active' ? '✅ Activo' : c.status === 'completed' ? '🏁 Finalizado' : '🚫 Cancelado'}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
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
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  inner: { padding: 20, gap: 10, paddingBottom: 48 },
  banner: {
    backgroundColor: Colors.warningLight, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.warning,
  },
  bannerText: { fontSize: 13, color: Colors.warning, fontWeight: '700' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase' },
  empty: { fontSize: 13, color: Colors.textMuted, fontStyle: 'italic' },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14, gap: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  sessionIcon: { fontSize: 28 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  rowMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  rowStatus: { fontSize: 12, fontWeight: '700', marginTop: 6 },
  rowAction: { fontSize: 12, color: Colors.warning, fontWeight: '700', marginTop: 6 },
  badge: {
    fontSize: 12, color: Colors.primary, fontWeight: '700', marginTop: 6,
  },
  chevron: { fontSize: 24, color: Colors.textDisabled },
})
