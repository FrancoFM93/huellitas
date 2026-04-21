import { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Modal, TextInput, FlatList,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Colors } from '@/constants/colors'
import type { Fundraiser, Donation } from '@/types'

function formatAmount(n: number): string {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
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

const BENEFICIARY_ICONS: Record<string, string> = {
  person: '🙋',
  animal: '🐾',
  emergency_fund: '💰',
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: 'Activa', color: Colors.success },
  completed: { label: 'Completada', color: Colors.primary },
  cancelled: { label: 'Cancelada', color: Colors.textMuted },
}

export default function FundraiserDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { session, profile } = useAuthStore()
  const qc = useQueryClient()
  const [donating, setDonating] = useState(false)

  const { data: fundraiser, isLoading } = useQuery({
    queryKey: ['fundraiser', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('fundraisers')
        .select('*, creator:profiles(id,name,avatar_url,type)')
        .eq('id', id)
        .single()
      return data as Fundraiser
    },
  })

  const { data: donations } = useQuery({
    queryKey: ['fundraiser-donations', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('donations')
        .select('*, donor:profiles(id,name,avatar_url)')
        .eq('fundraiser_id', id)
        .order('created_at', { ascending: false })
        .limit(20)
      return (data ?? []) as (Donation & { donor?: { id: string; name: string } })[]
    },
  })

  const donateMutation = useMutation({
    mutationFn: async ({ amount, message }: { amount: number; message: string }) => {
      if (!session?.user) throw new Error('Debes iniciar sesión para donar')
      const { error } = await supabase.from('donations').insert({
        fundraiser_id: id,
        donor_id: session.user.id,
        amount,
        anonymous: false,
        message: message || null,
      })
      if (error) throw error
      await supabase.rpc('increment_fundraiser', { fundraiser_id: id, amount_to_add: amount })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fundraiser', id] })
      qc.invalidateQueries({ queryKey: ['fundraiser-donations', id] })
      qc.invalidateQueries({ queryKey: ['fundraisers'] })
      setDonating(false)
      Alert.alert('¡Gracias!', 'Tu donación fue registrada 💚')
    },
    onError: (e: Error) => Alert.alert('Error', e.message),
  })

  if (isLoading || !fundraiser) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    )
  }

  const progress = Math.min(fundraiser.current_amount / fundraiser.target_amount, 1)
  const statusInfo = STATUS_LABELS[fundraiser.status]
  const creator = fundraiser.creator as any
  const isOwner = profile?.id === fundraiser.creator_id

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
          <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroIcon}>{BENEFICIARY_ICONS[fundraiser.beneficiary_type]}</Text>
          <Text style={styles.title}>{fundraiser.title}</Text>
          <View style={styles.creatorRow}>
            <Text style={styles.creatorText}>por </Text>
            <Text style={styles.creatorName}>{creator?.name ?? 'Anónimo'}</Text>
            <Text style={styles.creatorTime}> · {timeAgo(fundraiser.created_at)}</Text>
          </View>
        </View>

        {/* Progress */}
        <View style={styles.progressCard}>
          <Text style={styles.raisedAmount}>{formatAmount(fundraiser.current_amount)}</Text>
          <Text style={styles.goalText}>recaudados de {formatAmount(fundraiser.target_amount)}</Text>

          <View style={styles.progressBg}>
            <View style={[styles.progressBar, { width: `${progress * 100}%` as any }]} />
          </View>

          <Text style={styles.progressPct}>{Math.round(progress * 100)}% completado</Text>
        </View>

        {/* Donate button */}
        {fundraiser.status === 'active' && (
          <TouchableOpacity
            style={styles.donateBtn}
            onPress={() => {
              if (!session) {
                Alert.alert('Iniciar sesión', 'Debes iniciar sesión para donar')
                return
              }
              setDonating(true)
            }}
          >
            <Text style={styles.donateBtnText}>💚 Donar a esta campaña</Text>
          </TouchableOpacity>
        )}

        {/* Description */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sobre la campaña</Text>
          <Text style={styles.cardText}>{fundraiser.description}</Text>
        </View>

        {/* Donations list */}
        {(donations?.length ?? 0) > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Donaciones ({donations?.length ?? 0})
            </Text>
            {donations?.map((d) => (
              <View key={d.id} style={styles.donationRow}>
                <View style={styles.donorAvatar}>
                  <Text style={styles.donorAvatarIcon}>👤</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.donorName}>{d.donor?.name ?? 'Anónimo'}</Text>
                  {d.message && (
                    <Text style={styles.donorMessage} numberOfLines={2}>{d.message}</Text>
                  )}
                  <Text style={styles.donorTime}>{timeAgo(d.created_at)}</Text>
                </View>
                <Text style={styles.donationAmount}>{formatAmount(d.amount)}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <DonateModal
        visible={donating}
        title={fundraiser.title}
        onClose={() => setDonating(false)}
        onDonate={(amount, message) => donateMutation.mutate({ amount, message })}
        loading={donateMutation.isPending}
      />
    </SafeAreaView>
  )
}

function DonateModal({
  visible, title, onClose, onDonate, loading,
}: {
  visible: boolean
  title: string
  onClose: () => void
  onDonate: (amount: number, message: string) => void
  loading: boolean
}) {
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')
  const QUICK = [500, 1000, 2000, 5000]

  const submit = () => {
    const n = parseFloat(amount)
    if (!n || n <= 0) {
      Alert.alert('Monto inválido', 'Ingresa un monto mayor a 0')
      return
    }
    onDonate(n, message)
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={modal.overlay}>
        <View style={modal.sheet}>
          <Text style={modal.label}>Donar a</Text>
          <Text style={modal.title} numberOfLines={2}>{title}</Text>

          <View style={modal.quickRow}>
            {QUICK.map((q) => (
              <TouchableOpacity
                key={q}
                style={[modal.quickBtn, amount === String(q) && modal.quickBtnActive]}
                onPress={() => setAmount(String(q))}
              >
                <Text style={[modal.quickText, amount === String(q) && modal.quickTextActive]}>
                  ${q.toLocaleString()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={modal.input}
            value={amount}
            onChangeText={setAmount}
            placeholder="Otro monto"
            placeholderTextColor={Colors.textDisabled}
            keyboardType="numeric"
          />
          <TextInput
            style={[modal.input, modal.inputMsg]}
            value={message}
            onChangeText={setMessage}
            placeholder="Mensaje (opcional)"
            placeholderTextColor={Colors.textDisabled}
            multiline
          />

          <View style={modal.actions}>
            <TouchableOpacity style={modal.cancelBtn} onPress={onClose}>
              <Text style={modal.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modal.donateBtn, loading && { opacity: 0.6 }]}
              onPress={submit}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={Colors.white} />
                : <Text style={modal.donateBtnText}>Donar 💚</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
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
  statusBadge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  statusText: { fontSize: 12, fontWeight: '700' },
  inner: { padding: 20, gap: 16, paddingBottom: 48 },

  hero: { alignItems: 'center', gap: 8 },
  heroIcon: { fontSize: 56 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  creatorRow: { flexDirection: 'row', alignItems: 'center' },
  creatorText: { fontSize: 13, color: Colors.textMuted },
  creatorName: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  creatorTime: { fontSize: 13, color: Colors.textDisabled },

  progressCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  raisedAmount: { fontSize: 32, fontWeight: '900', color: Colors.primary },
  goalText: { fontSize: 13, color: Colors.textMuted },
  progressBg: {
    height: 10,
    backgroundColor: Colors.border,
    borderRadius: 5,
    overflow: 'hidden',
    width: '100%',
  },
  progressBar: { height: '100%', backgroundColor: Colors.primary, borderRadius: 5 },
  progressPct: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },

  donateBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  donateBtnText: { color: Colors.white, fontSize: 16, fontWeight: '800' },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  cardText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },

  donationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  donorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  donorAvatarIcon: { fontSize: 18 },
  donorName: { fontSize: 13, fontWeight: '700', color: Colors.text },
  donorMessage: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  donorTime: { fontSize: 11, color: Colors.textDisabled, marginTop: 2 },
  donationAmount: { fontSize: 14, fontWeight: '700', color: Colors.primary },
})

const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 14,
  },
  label: { fontSize: 14, color: Colors.textMuted },
  title: { fontSize: 20, fontWeight: '800', color: Colors.text },
  quickRow: { flexDirection: 'row', gap: 8 },
  quickBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  quickBtnActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  quickText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  quickTextActive: { color: Colors.primaryDark },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
  },
  inputMsg: { minHeight: 70, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelText: { fontSize: 15, color: Colors.textSecondary, fontWeight: '600' },
  donateBtn: {
    flex: 2,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  donateBtnText: { fontSize: 15, color: Colors.white, fontWeight: '700' },
})
