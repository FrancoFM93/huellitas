import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { Colors } from '@/constants/colors'
import { DonationsUnavailable } from '@/components/DonationsUnavailable'
import { LoadFeedback } from '@/components/LoadFeedback'
import type { Fundraiser } from '@/types'

const BENEFICIARY_ICONS: Record<string, string> = {
  person: '🙋', animal: '🐾', emergency_fund: '💰',
}

function formatAmount(n: number): string {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

export default function FundraiserDetail() {
  const { t } = useTranslation()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data: fundraiser, isLoading, isError, refetch } = useQuery({
    queryKey: ['fundraiser', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fundraisers')
        .select('*, creator:profiles(id,name,avatar_url,type)')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return data as Fundraiser | null
    },
    enabled: !!id,
  })

  const goBack = () => {
    if (router.canGoBack()) router.back()
    else router.replace('/(tabs)/fund')
  }

  if (isLoading || isError || !fundraiser) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadFeedback
          loading={isLoading}
          message={t(isError ? 'common.load_error' : 'fundraising.not_found')}
          onRetry={isError ? () => { void refetch() } : undefined}
          onBack={goBack}
        />
      </SafeAreaView>
    )
  }

  const statusColor = fundraiser.status === 'active' ? Colors.success
    : fundraiser.status === 'completed' ? Colors.primary : Colors.textMuted

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={goBack} accessibilityRole="button">
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {t(`fundraising.detail_${fundraiser.status}`)}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroIcon}>{BENEFICIARY_ICONS[fundraiser.beneficiary_type]}</Text>
          <Text style={styles.title}>{fundraiser.title}</Text>
          <Text style={styles.creatorText}>
            {t('fundraising.by', { name: fundraiser.creator?.name ?? t('common.anonymous') })}
          </Text>
        </View>
        <DonationsUnavailable />
        <View style={styles.card}>
          <Text style={styles.goalText}>{t('fund.goal', { amount: formatAmount(fundraiser.target_amount) })}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('fundraising.about')}</Text>
          <Text style={styles.cardText}>{fundraiser.description}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backText: { color: Colors.primary, fontSize: 15, fontWeight: '500', paddingVertical: 8 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  statusText: { fontSize: 12, fontWeight: '700' },
  inner: { padding: 20, gap: 16, paddingBottom: 48 },
  hero: { alignItems: 'center', gap: 8 },
  heroIcon: { fontSize: 56 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  creatorText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
  goalText: { fontSize: 15, color: Colors.text, fontWeight: '600' },
  card: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 16,
    gap: 12, borderWidth: 1, borderColor: Colors.border,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  cardText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },
})
