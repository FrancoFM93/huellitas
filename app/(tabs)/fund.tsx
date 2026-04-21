import { useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Modal, TextInput, Alert, ScrollView,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Colors } from '@/constants/colors'
import type { Fundraiser, EmergencyFund } from '@/types'

async function fetchFundraisers(): Promise<Fundraiser[]> {
  const { data } = await supabase
    .from('fundraisers')
    .select('*, creator:profiles(id,name,avatar_url)')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
  return (data ?? []) as Fundraiser[]
}

async function fetchEmergencyFund(): Promise<EmergencyFund | null> {
  const { data } = await supabase
    .from('emergency_fund')
    .select('*')
    .single()
  return data
}

function formatAmount(n: number): string {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

function FundraiserCard({ item }: { item: Fundraiser }) {
  const progress = Math.min(item.current_amount / item.target_amount, 1)
  const icon = item.beneficiary_type === 'person' ? '🙋' : item.beneficiary_type === 'animal' ? '🐾' : '💰'

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/fundraising/${item.id}`)}
      activeOpacity={0.8}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardIcon}>{icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.cardAuthor}>por {item.creator?.name ?? 'Anónimo'}</Text>
        </View>
      </View>

      <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>

      <View style={styles.progressContainer}>
        <View style={styles.progressBg}>
          <View style={[styles.progressBar, { width: `${progress * 100}%` as any }]} />
        </View>
        <View style={styles.progressLabels}>
          <Text style={styles.raisedText}>{formatAmount(item.current_amount)} recaudados</Text>
          <Text style={styles.goalText}>Meta: {formatAmount(item.target_amount)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

function DonateModal({
  visible,
  title,
  onClose,
  onDonate,
  loading,
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
          <Text style={modal.title}>Donar a</Text>
          <Text style={modal.subtitle} numberOfLines={2}>{title}</Text>

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
                : <Text style={modal.donateText}>Donar 💚</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

export default function Fund() {
  const { session } = useAuthStore()
  const qc = useQueryClient()
  const [donatingTo, setDonatingTo] = useState<string | null>(null) // fundraiser id or 'emergency'
  const [donatingTitle, setDonatingTitle] = useState('')

  const { data: fundraisers, isLoading } = useQuery({
    queryKey: ['fundraisers'],
    queryFn: fetchFundraisers,
  })

  const { data: emergencyFund } = useQuery({
    queryKey: ['emergency-fund'],
    queryFn: fetchEmergencyFund,
  })

  const donateMutation = useMutation({
    mutationFn: async ({ amount, message }: { amount: number; message: string }) => {
      if (!session?.user) throw new Error('No autenticado')

      if (donatingTo === 'emergency') {
        const { error } = await supabase.from('donations').insert({
          fundraiser_id: null,
          donor_id: session.user.id,
          amount,
          anonymous: false,
          message: message || null,
        })
        if (error) throw error
        // update fund total
        await supabase.rpc('increment_emergency_fund', { amount_to_add: amount })
      } else {
        const { error } = await supabase.from('donations').insert({
          fundraiser_id: donatingTo,
          donor_id: session.user.id,
          amount,
          anonymous: false,
          message: message || null,
        })
        if (error) throw error
        // update fundraiser total
        await supabase.rpc('increment_fundraiser', {
          fundraiser_id: donatingTo,
          amount_to_add: amount,
        })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fundraisers'] })
      qc.invalidateQueries({ queryKey: ['emergency-fund'] })
      setDonatingTo(null)
      Alert.alert('¡Gracias!', 'Tu donación fue registrada correctamente 💚')
    },
    onError: (e: Error) => Alert.alert('Error', e.message),
  })

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Fondos y Donaciones</Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => router.push('/fundraising/new')}
        >
          <Text style={styles.createBtnText}>+ Crear</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Emergency Fund */}
        <View style={styles.emergencyCard}>
          <View style={styles.emergencyHeader}>
            <Text style={styles.emergencyIcon}>🏦</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.emergencyTitle}>Fondo de Emergencia</Text>
              <Text style={styles.emergencySubtitle}>Disponible para cualquier emergencia animal</Text>
            </View>
          </View>
          <Text style={styles.emergencyAmount}>
            {emergencyFund ? formatAmount(emergencyFund.total_amount) : '$0'}
          </Text>
          <Text style={styles.emergencyCaption}>acumulados entre toda la comunidad</Text>
          <TouchableOpacity
            style={styles.emergencyBtn}
            onPress={() => {
              setDonatingTo('emergency')
              setDonatingTitle('Fondo de Emergencia')
            }}
          >
            <Text style={styles.emergencyBtnText}>Contribuir al fondo</Text>
          </TouchableOpacity>
        </View>

        {/* Fundraisers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Campañas activas</Text>

          {isLoading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
          ) : (fundraisers?.length ?? 0) === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>💝</Text>
              <Text style={styles.emptyText}>No hay campañas activas</Text>
              <TouchableOpacity onPress={() => router.push('/fundraising/new')}>
                <Text style={styles.emptyLink}>Crear una campaña</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.fundraiserList}>
              {(fundraisers ?? []).map((f) => (
                <FundraiserCard key={f.id} item={f} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <DonateModal
        visible={donatingTo !== null}
        title={donatingTitle}
        onClose={() => setDonatingTo(null)}
        onDonate={(amount, message) => donateMutation.mutate({ amount, message })}
        loading={donateMutation.isPending}
      />
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
  title: { fontSize: 20, fontWeight: '800', color: Colors.text },
  createBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  createBtnText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  emergencyCard: {
    margin: 16,
    backgroundColor: Colors.primaryDark,
    borderRadius: 20,
    padding: 20,
    gap: 8,
  },
  emergencyHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emergencyIcon: { fontSize: 32 },
  emergencyTitle: { fontSize: 17, fontWeight: '800', color: Colors.white },
  emergencySubtitle: { fontSize: 12, color: Colors.primaryLight, marginTop: 2 },
  emergencyAmount: { fontSize: 36, fontWeight: '900', color: Colors.white },
  emergencyCaption: { fontSize: 12, color: Colors.primaryLight },
  emergencyBtn: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  emergencyBtnText: { color: Colors.primaryDark, fontSize: 15, fontWeight: '700' },
  section: { paddingHorizontal: 16, paddingBottom: 32 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  fundraiserList: { gap: 12 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  cardHeader: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  cardIcon: { fontSize: 32 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, flex: 1 },
  cardAuthor: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  cardDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  progressContainer: { gap: 6 },
  progressBg: { height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: Colors.primary, borderRadius: 4 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  raisedText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  goalText: { fontSize: 12, color: Colors.textMuted },
  empty: { alignItems: 'center', paddingTop: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyText: { fontSize: 14, color: Colors.textMuted },
  emptyLink: { color: Colors.primary, fontSize: 14, fontWeight: '600', marginTop: 8 },
})

const modal = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 14,
  },
  title: { fontSize: 16, color: Colors.textMuted },
  subtitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
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
  donateText: { fontSize: 15, color: Colors.white, fontWeight: '700' },
})
