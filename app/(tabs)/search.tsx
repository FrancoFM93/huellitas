import { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { Colors } from '@/constants/colors'
import type { VetWithProfile, ClinicWithProfile } from '@/types'

type Tab = 'vets' | 'clinics'

async function fetchVets(search: string): Promise<VetWithProfile[]> {
  let query = supabase
    .from('vet_profiles')
    .select('*, profile:profiles(*)')
    .order('available', { ascending: false })

  if (search) {
    query = query.ilike('profile.name', `%${search}%`)
  }

  const { data } = await query.limit(30)
  return (data ?? []) as VetWithProfile[]
}

async function fetchClinics(search: string): Promise<ClinicWithProfile[]> {
  let query = supabase
    .from('clinic_profiles')
    .select('*, profile:profiles(*)')

  if (search) {
    query = query.ilike('profile.name', `%${search}%`)
  }

  const { data } = await query.limit(30)
  return (data ?? []) as ClinicWithProfile[]
}

function VetCard({ item }: { item: VetWithProfile }) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/vets/${item.id}`)}
      activeOpacity={0.8}
    >
      <View style={styles.cardLeft}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>🩺</Text>
        </View>
        <View style={[styles.availBadge, { backgroundColor: item.available ? Colors.successLight : Colors.border }]}>
          <View style={[styles.availDot, { backgroundColor: item.available ? Colors.success : Colors.textDisabled }]} />
          <Text style={[styles.availText, { color: item.available ? Colors.success : Colors.textMuted }]}>
            {item.available ? 'Disponible' : 'Ocupado'}
          </Text>
        </View>
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardName}>{item.profile?.name ?? 'Veterinario'}</Text>
        {item.specialties?.length > 0 && (
          <Text style={styles.cardSpecialties} numberOfLines={1}>
            {item.specialties.slice(0, 2).join(' · ')}
            {item.specialties.length > 2 ? ` +${item.specialties.length - 2}` : ''}
          </Text>
        )}
        {item.consultation_fee && (
          <Text style={styles.cardFee}>Consulta: ${item.consultation_fee}</Text>
        )}
        {item.phone && (
          <Text style={styles.cardContact}>📞 {item.phone}</Text>
        )}
      </View>
    </TouchableOpacity>
  )
}

function ClinicCard({ item }: { item: ClinicWithProfile }) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/clinics/${item.id}`)}
      activeOpacity={0.8}
    >
      <View style={styles.cardLeft}>
        <View style={[styles.avatar, styles.avatarClinic]}>
          <Text style={styles.avatarText}>🏥</Text>
        </View>
        {item.emergency_24h && (
          <View style={[styles.availBadge, { backgroundColor: Colors.alertLight }]}>
            <Text style={[styles.availText, { color: Colors.alert }]}>24hs</Text>
          </View>
        )}
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardName}>{item.profile?.name ?? 'Clínica'}</Text>
        <Text style={styles.cardContact} numberOfLines={1}>📍 {item.address}</Text>
        <Text style={styles.cardContact}>📞 {item.phone}</Text>
        {item.services?.length > 0 && (
          <Text style={styles.cardSpecialties} numberOfLines={1}>
            {item.services.slice(0, 3).join(' · ')}
            {item.services.length > 3 ? ` +${item.services.length - 3}` : ''}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  )
}

export default function Search() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('vets')
  const [search, setSearch] = useState('')

  const { data: vets, isLoading: vetsLoading } = useQuery({
    queryKey: ['vets', search],
    queryFn: () => fetchVets(search),
    enabled: tab === 'vets',
  })

  const { data: clinics, isLoading: clinicsLoading } = useQuery({
    queryKey: ['clinics', search],
    queryFn: () => fetchClinics(search),
    enabled: tab === 'clinics',
  })

  const loading = tab === 'vets' ? vetsLoading : clinicsLoading

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('search.title')}</Text>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={tab === 'vets' ? t('search.search_vet') : t('search.search_clinic')}
            placeholderTextColor={Colors.textDisabled}
          />
        </View>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, tab === 'vets' && styles.tabActive]}
            onPress={() => setTab('vets')}
          >
            <Text style={[styles.tabText, tab === 'vets' && styles.tabTextActive]}>
              {t('search.tab_vets')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'clinics' && styles.tabActive]}
            onPress={() => setTab('clinics')}
          >
            <Text style={[styles.tabText, tab === 'clinics' && styles.tabTextActive]}>
              {t('search.tab_clinics')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : tab === 'vets' ? (
        <FlatList
          data={vets ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <VetCard item={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<EmptyState type="vets" />}
        />
      ) : (
        <FlatList
          data={clinics ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ClinicCard item={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<EmptyState type="clinics" />}
        />
      )}
    </SafeAreaView>
  )
}

function EmptyState({ type }: { type: Tab }) {
  const { t } = useTranslation()
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>{type === 'vets' ? '🩺' : '🏥'}</Text>
      <Text style={styles.emptyText}>
        {type === 'vets' ? t('search.empty_vets') : t('search.empty_clinics')}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  title: { fontSize: 20, fontWeight: '800', color: Colors.text },
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
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: Colors.text },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  tabTextActive: { color: Colors.white, fontWeight: '700' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 10 },
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  cardLeft: { alignItems: 'center', gap: 6 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarClinic: { backgroundColor: Colors.infoLight },
  avatarText: { fontSize: 24 },
  availBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 3,
  },
  availDot: { width: 5, height: 5, borderRadius: 3 },
  availText: { fontSize: 10, fontWeight: '600' },
  cardContent: { flex: 1, gap: 3 },
  cardName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  cardSpecialties: { fontSize: 12, color: Colors.primary, fontWeight: '500' },
  cardFee: { fontSize: 12, color: Colors.textSecondary },
  cardContact: { fontSize: 12, color: Colors.textMuted },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyText: { fontSize: 14, color: Colors.textMuted },
})
