import { useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { Colors } from '@/constants/colors'
import { LoadFeedback } from '@/components/LoadFeedback'
import type { AdoptionPost, Profile } from '@/types'

type PublicProfileRow = Pick<Profile,
  'id' | 'type' | 'name' | 'avatar_url' | 'bio' | 'verified' | 'country' | 'region' | 'city_slug' | 'created_at'
> & {
  vet: { id: string } | null
  clinic: { id: string } | null
}

type ProfilePost = Pick<AdoptionPost, 'id' | 'name' | 'species' | 'age_range' | 'status' | 'photos' | 'created_at'>

const SPECIES_ICONS: Record<string, string> = {
  dog: '🐶', cat: '🐱', bird: '🐦', rabbit: '🐰', other: '🐾',
}

export default function PublicProfile() {
  const { t } = useTranslation()
  const { id } = useLocalSearchParams<{ id: string }>()

  const { data: profile, isLoading, isError, refetch } = useQuery({
    queryKey: ['public-profile', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id,type,name,avatar_url,bio,verified,country,region,city_slug,created_at,vet:vet_profiles(id),clinic:clinic_profiles(id)')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return data as unknown as PublicProfileRow | null
    },
    enabled: !!id,
  })

  const { data: posts, isLoading: postsLoading, isError: postsError, refetch: refetchPosts } = useQuery({
    queryKey: ['public-profile-posts', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('adoption_posts')
        .select('id,name,species,age_range,status,photos,created_at')
        .eq('poster_id', id)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return (data ?? []) as ProfilePost[]
    },
    enabled: !!id,
  })

  // Foundations have a richer page already
  useEffect(() => {
    if (profile?.type === 'fundacion') {
      router.replace(`/orgs/${profile.id}`)
    }
  }, [profile?.id, profile?.type])

  const goBack = () => {
    if (router.canGoBack()) router.back()
    else router.replace('/(tabs)/search')
  }

  if (isLoading || isError || !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadFeedback
          loading={isLoading}
          message={t(isError ? 'common.load_error' : 'profile.public_not_found')}
          onRetry={isError ? () => { void refetch() } : undefined}
          onBack={goBack}
        />
      </SafeAreaView>
    )
  }

  const cityLine = [profile.region, profile.country].filter(Boolean).join(', ')
  const totalPosts = posts?.length ?? 0
  const adopted = (posts ?? []).filter((p) => p.status === 'adopted').length
  const professionalId = profile.type === 'vet' ? profile.vet?.id : profile.clinic?.id

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={goBack} accessibilityRole="button">
          <Text style={styles.backText}>{t('profile.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{t('profile.public_title')}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.inner}>
        <View style={styles.hero}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>{profile.name?.[0]?.toUpperCase() ?? '?'}</Text>
            </View>
          )}
          <Text style={styles.name}>{profile.name}</Text>
          <View style={styles.badges}>
            {profile.type === 'vet' && <Badge text={t('profile.public_vet_badge')} />}
            {profile.type === 'clinic' && <Badge text={t('profile.public_clinic_badge')} />}
            {profile.verified && <Badge text={t('profile.public_verified_badge')} tone="success" />}
          </View>
          {!!cityLine && <Text style={styles.city}>📍 {cityLine}</Text>}
          {!!profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
        </View>

        {totalPosts > 0 && (
          <View style={styles.statsRow}>
            <Stat value={totalPosts} label={t('profile.public_recent_posts')} />
            <Stat value={adopted} label={t('profile.public_stat_adopted')} />
          </View>
        )}

        {(profile.type === 'vet' || profile.type === 'clinic') && (
          professionalId ? (
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => router.push(profile.type === 'vet' ? `/vets/${professionalId}` : `/clinics/${professionalId}`)}
              accessibilityRole="button"
            >
              <Text style={styles.linkBtnText}>
                {profile.type === 'vet' ? t('profile.public_view_vet') : t('profile.public_view_clinic')}
              </Text>
            </TouchableOpacity>
          ) : (
            <LoadFeedback message={t('profile.professional_not_found')} onRetry={() => { void refetch() }} />
          )
        )}

        <Text style={styles.sectionTitle}>{t('profile.public_section_posts')}</Text>
        {postsLoading ? (
          <LoadFeedback loading />
        ) : postsError ? (
          <LoadFeedback message={t('common.load_error')} onRetry={() => { void refetchPosts() }} />
        ) : totalPosts === 0 ? (
          <Text style={styles.empty}>{t('profile.public_no_posts')}</Text>
        ) : (
          posts?.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={styles.row}
              onPress={() => router.push(`/adoption/${p.id}`)}
            >
              {p.photos?.[0] ? (
                <Image source={{ uri: p.photos[0] }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbFallback]}>
                  <Text style={styles.thumbIcon}>{SPECIES_ICONS[p.species] ?? '🐾'}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{p.name}</Text>
                <Text style={styles.rowMeta}>
                  {p.status === 'available' ? t('profile.post_available') :
                    p.status === 'reserved' ? t('profile.post_reserved') : t('profile.post_adopted')}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function Badge({ text, tone }: { text: string; tone?: 'success' }) {
  return (
    <View style={[styles.badge, tone === 'success' && styles.badgeSuccess]}>
      <Text style={[styles.badgeText, tone === 'success' && styles.badgeTextSuccess]}>{text}</Text>
    </View>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
  inner: { padding: 20, gap: 14, paddingBottom: 48 },
  hero: { alignItems: 'center', gap: 8 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.borderLight },
  avatarFallback: { justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.primaryLight },
  avatarInitial: { fontSize: 36, fontWeight: '800', color: Colors.primaryDark },
  name: { fontSize: 22, fontWeight: '800', color: Colors.text },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' },
  badge: {
    backgroundColor: Colors.borderLight, borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  badgeSuccess: { backgroundColor: Colors.successLight },
  badgeText: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
  badgeTextSuccess: { color: Colors.success },
  city: { fontSize: 13, color: Colors.textMuted },
  bio: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginTop: 4 },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  statValue: { fontSize: 22, fontWeight: '800', color: Colors.text },
  statLabel: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  linkBtn: {
    backgroundColor: Colors.primaryLight, borderRadius: 12,
    paddingVertical: 13, alignItems: 'center',
  },
  linkBtnText: { color: Colors.primaryDark, fontSize: 14, fontWeight: '700' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', marginTop: 6 },
  empty: { fontSize: 13, color: Colors.textMuted, fontStyle: 'italic' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  thumb: { width: 64, height: 64, borderRadius: 10 },
  thumbFallback: { backgroundColor: Colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  thumbIcon: { fontSize: 28 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  rowMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  chevron: { fontSize: 24, color: Colors.textDisabled },
})
