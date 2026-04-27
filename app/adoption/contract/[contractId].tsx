import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Colors } from '@/constants/colors'

export default function ContractScreen() {
  const { t } = useTranslation()
  const { contractId } = useLocalSearchParams<{ contractId: string }>()
  const { profile } = useAuthStore()

  const SESSION_TYPE_LABEL: Record<string, { icon: string; label: string }> = {
    photo: { icon: '📷', label: t('contract.session_photo') },
    video: { icon: '🎥', label: t('contract.session_video') },
  }
  const SESSION_STATUS_LABEL: Record<string, { text: string; color: string }> = {
    scheduled: { text: t('contract.session_scheduled'), color: Colors.warning },
    completed: { text: t('contract.session_completed'), color: Colors.success },
    missed:    { text: t('contract.session_missed'), color: Colors.alert },
  }

  const { data: contract, isLoading } = useQuery({
    queryKey: ['contract', contractId],
    queryFn: async () => {
      const { data } = await supabase
        .from('adoption_contracts')
        .select('*, post:adoption_posts(id,name,species), adopter:profiles!adopter_id(id,name,avatar_url), poster:profiles!poster_id(id,name,avatar_url,type,verified)')
        .eq('id', contractId)
        .single()
      return data as any
    },
  })

  const { data: sessions } = useQuery({
    queryKey: ['sessions', contractId],
    queryFn: async () => {
      const { data } = await supabase
        .from('monitoring_sessions')
        .select('*')
        .eq('contract_id', contractId)
        .order('scheduled_at', { ascending: true })
      return data ?? []
    },
  })

  if (isLoading || !contract) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    )
  }

  const isAdopter = profile?.id === contract.adopter_id

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>{t('profile.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{t('contract.title')}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.inner}>
        <View style={styles.hero}>
          <Text style={styles.heroIcon}>🏠</Text>
          <Text style={styles.heroName}>{contract.post?.name ?? t('contract.pet_fallback')}</Text>
          <View style={[styles.statusPill, contract.status === 'active' && { backgroundColor: Colors.successLight }]}>
            <Text style={[styles.statusPillText, { color: contract.status === 'active' ? Colors.success : Colors.textMuted }]}>
              {contract.status === 'active' ? t('contract.active') : contract.status === 'completed' ? t('contract.completed') : t('contract.cancelled')}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Row label={t('contract.signed_at')} value={new Date(contract.signed_at).toLocaleDateString()} />
          <Row label={t('contract.monitoring_until')} value={new Date(contract.monitoring_until).toLocaleDateString()} />
          <Row label={t('contract.adopter')} value={contract.adopter?.name ?? '—'} />
          <Row label={contract.poster?.type === 'fundacion' ? t('contract.poster_fundacion') : t('contract.poster_default')}
               value={contract.poster?.name ?? '—'} />
        </View>

        <Text style={styles.sectionTitle}>{t('contract.sessions_title')}</Text>
        <View style={styles.sessionsCol}>
          {(sessions ?? []).map((s: any) => {
            const type = SESSION_TYPE_LABEL[s.type]
            const status = SESSION_STATUS_LABEL[s.status]
            const scheduled = new Date(s.scheduled_at)
            const isUpcoming = s.status === 'scheduled' && scheduled.getTime() > Date.now()
            return (
              <TouchableOpacity
                key={s.id}
                style={styles.sessionRow}
                onPress={() => router.push(`/monitoring/${s.id}`)}
                disabled={!isAdopter && s.status !== 'scheduled'}
              >
                <Text style={styles.sessionIcon}>{type?.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sessionLabel}>{type?.label ?? s.type}</Text>
                  <Text style={styles.sessionDate}>{scheduled.toLocaleDateString()}</Text>
                  <Text style={[styles.sessionStatus, { color: status?.color ?? Colors.textMuted }]}>
                    {status?.text ?? s.status}
                  </Text>
                </View>
                {isUpcoming && <Text style={styles.chevron}>›</Text>}
              </TouchableOpacity>
            )
          })}
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeText}>{t('contract.notice')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
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
  topBarTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  inner: { padding: 20, gap: 16, paddingBottom: 48 },
  hero: { alignItems: 'center', gap: 8 },
  heroIcon: { fontSize: 64 },
  heroName: { fontSize: 24, fontWeight: '800', color: Colors.text },
  statusPill: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  statusPillText: { fontSize: 13, fontWeight: '700' },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  rowLabel: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
  rowValue: { fontSize: 13, color: Colors.text, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase' },
  sessionsCol: { gap: 10 },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sessionIcon: { fontSize: 24 },
  sessionLabel: { fontSize: 14, fontWeight: '700', color: Colors.text },
  sessionDate: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  sessionStatus: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  chevron: { fontSize: 24, color: Colors.textDisabled },
  notice: { backgroundColor: Colors.primaryLight, borderRadius: 12, padding: 14 },
  noticeText: { fontSize: 13, color: Colors.primaryDark, lineHeight: 19 },
})
