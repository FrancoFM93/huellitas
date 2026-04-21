import { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Colors } from '@/constants/colors'
import type { CommunityAlert, AlertResponse } from '@/types'

const SEVERITY_COLORS: Record<number, string> = {
  1: Colors.severity1, 2: Colors.severity2, 3: Colors.severity3,
  4: Colors.severity4, 5: Colors.severity5,
}

const SEVERITY_LABELS: Record<number, string> = {
  1: 'Bajo', 2: 'Leve', 3: 'Moderado', 4: 'Grave', 5: 'Crítico',
}

const CATEGORY_LABELS: Record<string, string> = {
  injured: 'Animal herido', abandoned: 'Abandono', abuse: 'Maltrato',
  stray: 'Animal callejero', emergency: 'Emergencia', other: 'Otro',
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

export default function AlertDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { profile } = useAuthStore()
  const qc = useQueryClient()
  const [responseMsg, setResponseMsg] = useState('')

  const { data: alert, isLoading } = useQuery({
    queryKey: ['alert', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('community_alerts')
        .select('*, creator:profiles(id,name,avatar_url,type)')
        .eq('id', id)
        .single()
      return data as CommunityAlert
    },
  })

  const { data: responses } = useQuery({
    queryKey: ['alert-responses', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('alert_responses')
        .select('*, responder:profiles(id,name,avatar_url,type)')
        .eq('alert_id', id)
        .order('created_at', { ascending: false })
      return (data ?? []) as AlertResponse[]
    },
  })

  const respondMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!profile) throw new Error('No autenticado')
      const { error } = await supabase.from('alert_responses').insert({
        alert_id: id,
        responder_id: profile.id,
        message,
        status: 'offered',
      })
      if (error) throw error
      // increment responses count
      await supabase
        .from('community_alerts')
        .update({ responses_count: (alert?.responses_count ?? 0) + 1 })
        .eq('id', id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alert-responses', id] })
      qc.invalidateQueries({ queryKey: ['alert', id] })
      setResponseMsg('')
    },
    onError: (e: Error) => Alert.alert('Error', e.message),
  })

  const handleRespond = () => {
    if (!responseMsg.trim()) return
    respondMutation.mutate(responseMsg.trim())
  }

  if (isLoading || !alert) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    )
  }

  const sevColor = SEVERITY_COLORS[alert.severity]

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <View style={[styles.sevBadge, { backgroundColor: sevColor + '20' }]}>
          <View style={[styles.sevDot, { backgroundColor: sevColor }]} />
          <Text style={[styles.sevText, { color: sevColor }]}>{SEVERITY_LABELS[alert.severity]}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>
        <Text style={styles.category}>{CATEGORY_LABELS[alert.category] ?? alert.category}</Text>
        <Text style={styles.title}>{alert.title}</Text>
        <Text style={styles.meta}>
          Reportado por {alert.creator?.name ?? 'Anónimo'} · {timeAgo(alert.created_at)}
        </Text>
        {alert.address && (
          <View style={styles.locationRow}>
            <Text style={styles.locationText}>📍 {alert.address}</Text>
          </View>
        )}

        <View style={styles.descCard}>
          <Text style={styles.descLabel}>Descripción</Text>
          <Text style={styles.desc}>{alert.description}</Text>
        </View>

        <View style={styles.statusRow}>
          <View style={[
            styles.statusBadge,
            {
              backgroundColor: alert.status === 'active' ? Colors.alertLight :
                alert.status === 'in_progress' ? Colors.warningLight : Colors.successLight,
            }
          ]}>
            <Text style={[
              styles.statusText,
              {
                color: alert.status === 'active' ? Colors.alert :
                  alert.status === 'in_progress' ? Colors.warning : Colors.success,
              }
            ]}>
              {alert.status === 'active' ? 'Activa' :
                alert.status === 'in_progress' ? 'En proceso' : 'Resuelta'}
            </Text>
          </View>
          <Text style={styles.responsesCount}>
            {alert.responses_count} {alert.responses_count === 1 ? 'respuesta' : 'respuestas'}
          </Text>
        </View>

        {/* Responses */}
        <Text style={styles.responsesTitle}>Respuestas de la comunidad</Text>
        {(responses ?? []).length === 0 ? (
          <Text style={styles.noResponses}>Sé el primero en responder</Text>
        ) : (
          <View style={styles.responsesList}>
            {(responses ?? []).map((r) => (
              <View key={r.id} style={styles.responseItem}>
                <View style={styles.responseHeader}>
                  <Text style={styles.responseAuthor}>{r.responder?.name ?? 'Anónimo'}</Text>
                  <View style={[
                    styles.respTypeBadge,
                    { backgroundColor: r.responder?.type === 'vet' || r.responder?.type === 'clinic' ? Colors.primaryLight : Colors.background }
                  ]}>
                    <Text style={styles.respTypeText}>
                      {r.responder?.type === 'vet' ? '🩺 Vet' :
                        r.responder?.type === 'clinic' ? '🏥 Clínica' : '👤'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.responseMsg}>{r.message}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Reply box */}
        {alert.status !== 'resolved' && (
          <View style={styles.replyBox}>
            <TextInput
              style={styles.replyInput}
              value={responseMsg}
              onChangeText={setResponseMsg}
              placeholder="Escribe tu respuesta o cómo puedes ayudar..."
              placeholderTextColor={Colors.textDisabled}
              multiline
            />
            <TouchableOpacity
              style={[styles.replyBtn, !responseMsg.trim() && { opacity: 0.4 }]}
              onPress={handleRespond}
              disabled={!responseMsg.trim() || respondMutation.isPending}
            >
              {respondMutation.isPending
                ? <ActivityIndicator color={Colors.white} size="small" />
                : <Text style={styles.replyBtnText}>Responder</Text>
              }
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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
  sevBadge: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, gap: 5 },
  sevDot: { width: 7, height: 7, borderRadius: 4 },
  sevText: { fontSize: 12, fontWeight: '700' },
  inner: { padding: 20, gap: 16, paddingBottom: 40 },
  category: { fontSize: 13, color: Colors.primary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.text, lineHeight: 30 },
  meta: { fontSize: 13, color: Colors.textMuted },
  locationRow: { flexDirection: 'row', alignItems: 'center' },
  locationText: { fontSize: 13, color: Colors.textSecondary },
  descCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, gap: 8, borderWidth: 1, borderColor: Colors.border },
  descLabel: { fontSize: 12, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  desc: { fontSize: 14, color: Colors.text, lineHeight: 22 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusBadge: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5 },
  statusText: { fontSize: 13, fontWeight: '700' },
  responsesCount: { fontSize: 13, color: Colors.textMuted },
  responsesTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  noResponses: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', paddingVertical: 16 },
  responsesList: { gap: 10 },
  responseItem: { backgroundColor: Colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 6 },
  responseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  responseAuthor: { fontSize: 13, fontWeight: '600', color: Colors.text },
  respTypeBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  respTypeText: { fontSize: 11, color: Colors.primary, fontWeight: '500' },
  responseMsg: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  replyBox: { gap: 10 },
  replyInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 14,
    fontSize: 14,
    color: Colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  replyBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  replyBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
})
