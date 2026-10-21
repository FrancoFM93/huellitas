import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { Colors } from '@/constants/colors'
import { DonationsUnavailable } from '@/components/DonationsUnavailable'
import { LoadFeedback } from '@/components/LoadFeedback'
import type { Fundraiser } from '@/types'

async function fetchFundraisers(): Promise<Fundraiser[]> {
  const { data, error } = await supabase
    .from('fundraisers')
    .select('*, creator:profiles(id,name,avatar_url)')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Fundraiser[]
}

function formatAmount(n: number): string {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

function FundraiserCard({ item }: { item: Fundraiser }) {
  const { t } = useTranslation()
  const icon = item.beneficiary_type === 'person' ? '🙋' : item.beneficiary_type === 'animal' ? '🐾' : '💰'

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/fundraising/${item.id}`)}
      activeOpacity={0.8}
      accessibilityRole="button"
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardIcon}>{icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.cardAuthor}>{t('fund.by', { name: item.creator?.name ?? t('common.anonymous') })}</Text>
        </View>
      </View>
      <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
      <Text style={styles.goalText}>{t('fund.goal', { amount: formatAmount(item.target_amount) })}</Text>
    </TouchableOpacity>
  )
}

export default function Fund() {
  const { t } = useTranslation()
  const { data: fundraisers, isLoading, isError, refetch } = useQuery({
    queryKey: ['fundraisers'],
    queryFn: fetchFundraisers,
  })

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('fund.title')}</Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => router.push('/fundraising/new')}
          accessibilityRole="button"
        >
          <Text style={styles.createBtnText}>{t('fund.create')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>
        <DonationsUnavailable />
        <Text style={styles.sectionTitle}>{t('fund.active_campaigns')}</Text>
        {isLoading ? (
          <LoadFeedback loading />
        ) : isError ? (
          <LoadFeedback message={t('common.load_error')} onRetry={() => { void refetch() }} />
        ) : (fundraisers?.length ?? 0) === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💝</Text>
            <Text style={styles.emptyText}>{t('fund.no_campaigns')}</Text>
            <TouchableOpacity onPress={() => router.push('/fundraising/new')} accessibilityRole="button">
              <Text style={styles.emptyLink}>{t('fund.create_campaign')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.fundraiserList}>
            {fundraisers?.map((f) => <FundraiserCard key={f.id} item={f} />)}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12,
  },
  title: { flex: 1, fontSize: 20, fontWeight: '800', color: Colors.text },
  createBtn: { backgroundColor: Colors.primary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 12 },
  createBtnText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  inner: { padding: 16, paddingBottom: 32, gap: 16 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  fundraiserList: { gap: 12 },
  card: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.border, gap: 10,
  },
  cardHeader: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  cardIcon: { fontSize: 32 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  cardAuthor: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  cardDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  goalText: { fontSize: 12, color: Colors.textMuted },
  empty: { alignItems: 'center', paddingTop: 24 },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyText: { fontSize: 14, color: Colors.textMuted },
  emptyLink: { color: Colors.primary, fontSize: 14, fontWeight: '600', paddingVertical: 12 },
})
