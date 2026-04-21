import { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { Colors } from '@/constants/colors'
import type { AdoptionPost } from '@/types'

const SPECIES_ICONS: Record<string, string> = {
  dog: '🐶', cat: '🐱', bird: '🐦', rabbit: '🐰', other: '🐾',
}

const SPECIES_LABELS: Record<string, string> = {
  dog: 'Perro', cat: 'Gato', bird: 'Ave', rabbit: 'Conejo', other: 'Otro',
}

type FilterSpecies = 'all' | 'dog' | 'cat' | 'bird' | 'rabbit' | 'other'

const FILTERS: { value: FilterSpecies; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'dog', label: '🐶' },
  { value: 'cat', label: '🐱' },
  { value: 'bird', label: '🐦' },
  { value: 'rabbit', label: '🐰' },
  { value: 'other', label: '🐾' },
]

const AGE_LABELS: Record<string, string> = {
  puppy: 'Cachorro',
  young: 'Joven',
  adult: 'Adulto',
  senior: 'Mayor',
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

async function fetchAdoptions(species: FilterSpecies, search: string): Promise<AdoptionPost[]> {
  let query = supabase
    .from('adoption_posts')
    .select('*, poster:profiles(id,name,avatar_url,type)')
    .eq('status', 'available')
    .order('created_at', { ascending: false })
    .limit(40)

  if (species !== 'all') {
    query = query.eq('species', species)
  }
  if (search.trim()) {
    query = query.or(`name.ilike.%${search}%,breed.ilike.%${search}%,location.ilike.%${search}%`)
  }

  const { data } = await query
  return (data ?? []) as AdoptionPost[]
}

function AdoptionCard({ item }: { item: AdoptionPost }) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/adoption/${item.id}`)}
      activeOpacity={0.85}
    >
      <View style={styles.cardPhoto}>
        <Text style={styles.cardPhotoIcon}>{SPECIES_ICONS[item.species]}</Text>
        {item.is_vaccinated && (
          <View style={styles.vaccineBadge}>
            <Text style={styles.vaccineBadgeText}>💉 Vacunado</Text>
          </View>
        )}
        {item.is_neutered && (
          <View style={[styles.vaccineBadge, styles.neuteredBadge]}>
            <Text style={styles.vaccineBadgeText}>✂️ Castrado</Text>
          </View>
        )}
      </View>

      <View style={styles.cardInfo}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardName}>{item.name}</Text>
          <Text style={styles.cardAge}>{AGE_LABELS[item.age_range] ?? item.age_range}</Text>
        </View>

        <Text style={styles.cardBreed}>
          {SPECIES_LABELS[item.species]}{item.breed ? ` · ${item.breed}` : ''}
        </Text>

        <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>

        <View style={styles.cardFooter}>
          <Text style={styles.cardLocation} numberOfLines={1}>📍 {item.location}</Text>
          <Text style={styles.cardTime}>{timeAgo(item.created_at)}</Text>
        </View>

        <Text style={styles.cardPoster}>por {item.poster?.name ?? 'Anónimo'}</Text>
      </View>
    </TouchableOpacity>
  )
}

export default function Adopt() {
  const { t } = useTranslation()
  const [filterSpecies, setFilterSpecies] = useState<FilterSpecies>('all')
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['adoptions', filterSpecies, search],
    queryFn: () => fetchAdoptions(filterSpecies, search),
  })

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t('adopt.title')}</Text>
          <TouchableOpacity
            style={styles.postBtn}
            onPress={() => router.push('/adoption/new')}
          >
            <Text style={styles.postBtnText}>{t('adopt.post')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar por nombre, raza, zona..."
            placeholderTextColor={Colors.textDisabled}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={styles.clearSearch}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filterRow}>
          {FILTERS.map(({ value, label }) => (
            <TouchableOpacity
              key={value}
              style={[styles.filterBtn, filterSpecies === value && styles.filterBtnActive]}
              onPress={() => setFilterSpecies(value)}
            >
              <Text style={[styles.filterText, filterSpecies === value && styles.filterTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <AdoptionCard item={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🐾</Text>
              <Text style={styles.emptyTitle}>{t('adopt.empty_title')}</Text>
              <Text style={styles.emptyText}>
                {search || filterSpecies !== 'all'
                  ? t('adopt.empty_filter')
                  : t('adopt.empty_text')}
              </Text>
              {!search && filterSpecies === 'all' && (
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() => router.push('/adoption/new')}
                >
                  <Text style={styles.emptyBtnText}>{t('adopt.post_btn')}</Text>
                </TouchableOpacity>
              )}
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
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 10,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text },
  postBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  postBtnText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  searchIcon: { fontSize: 15 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: Colors.text },
  clearSearch: { fontSize: 14, color: Colors.textMuted, paddingHorizontal: 4 },
  filterRow: { flexDirection: 'row', gap: 6 },
  filterBtn: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 44,
    alignItems: 'center',
  },
  filterBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  filterTextActive: { color: Colors.white, fontWeight: '700' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
  },
  cardPhoto: {
    width: 110,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    gap: 4,
    paddingVertical: 12,
  },
  cardPhotoIcon: { fontSize: 52 },
  vaccineBadge: {
    backgroundColor: Colors.successLight,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  neuteredBadge: { backgroundColor: Colors.infoLight },
  vaccineBadgeText: { fontSize: 9, fontWeight: '700', color: Colors.text },
  cardInfo: { flex: 1, padding: 14, gap: 4 },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardName: { fontSize: 17, fontWeight: '800', color: Colors.text },
  cardAge: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
    backgroundColor: Colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  cardBreed: { fontSize: 12, color: Colors.primary, fontWeight: '500' },
  cardDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, marginTop: 2 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  cardLocation: { fontSize: 11, color: Colors.textMuted, flex: 1 },
  cardTime: { fontSize: 11, color: Colors.textDisabled },
  cardPoster: { fontSize: 11, color: Colors.textMuted },
  empty: { flex: 1, alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyIcon: { fontSize: 52, marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: 32 },
  emptyBtn: {
    marginTop: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyBtnText: { color: Colors.white, fontSize: 14, fontWeight: '700' },
})
