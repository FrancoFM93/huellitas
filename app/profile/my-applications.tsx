import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native'
import { useState, useCallback } from 'react'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Colors } from '@/constants/colors'

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  pending:   { text: '⏳ Pendiente', color: Colors.warning },
  approved:  { text: '✅ Aprobada', color: Colors.success },
  rejected:  { text: '❌ Rechazada', color: Colors.alert },
  withdrawn: { text: '🚫 Retirada', color: Colors.textMuted },
}

export default function MyApplications() {
  const { profile } = useAuthStore()
  const [refreshing, setRefreshing] = useState(false)

  const appsQuery = useQuery({
    queryKey: ['my-apps', profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('adoption_applications')
        .select('*, post:adoption_posts(id,name,species,photos)')
        .eq('applicant_id', profile!.id)
        .order('created_at', { ascending: false })
      return data ?? []
    },
    enabled: !!profile,
  })

  const contractsQuery = useQuery({
    queryKey: ['my-contracts', profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('adoption_contracts')
        .select('*, post:adoption_posts(id,name,species)')
        .eq('adopter_id', profile!.id)
        .order('signed_at', { ascending: false })
      return data ?? []
    },
    enabled: !!profile,
  })

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([appsQuery.refetch(), contractsQuery.refetch()])
    setRefreshing(false)
  }, [appsQuery, contractsQuery])

  const apps = appsQuery.data ?? []
  const contracts = contractsQuery.data ?? []
  const loading = appsQuery.isLoading || contractsQuery.isLoading

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Mis solicitudes</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={styles.loader}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.inner}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        >
          <Text style={styles.sectionTitle}>Solicitudes</Text>
          {apps.length === 0 ? (
            <Text style={styles.empty}>Aún no enviaste solicitudes</Text>
          ) : apps.map((a: any) => (
            <TouchableOpacity
              key={a.id}
              style={styles.row}
              onPress={() => router.push(`/adoption/${a.post_id}`)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{a.post?.name ?? 'Mascota'}</Text>
                <Text style={styles.rowMeta} numberOfLines={2}>{a.message}</Text>
                <Text style={[styles.rowStatus, { color: STATUS_LABELS[a.status]?.color ?? Colors.textMuted }]}>
                  {STATUS_LABELS[a.status]?.text ?? a.status}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}

          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Contratos activos</Text>
          {contracts.length === 0 ? (
            <Text style={styles.empty}>Todavía no tenés contratos</Text>
          ) : contracts.map((c: any) => (
            <TouchableOpacity
              key={c.id}
              style={styles.row}
              onPress={() => router.push(`/adoption/contract/${c.id}`)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{c.post?.name ?? 'Mascota'}</Text>
                <Text style={styles.rowMeta}>
                  Firmado {new Date(c.signed_at).toLocaleDateString()} · Seguimiento hasta {new Date(c.monitoring_until).toLocaleDateString()}
                </Text>
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
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  inner: { padding: 20, gap: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase' },
  empty: { fontSize: 13, color: Colors.textMuted, fontStyle: 'italic' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rowTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  rowMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 4, lineHeight: 17 },
  rowStatus: { fontSize: 12, fontWeight: '700', marginTop: 6 },
  chevron: { fontSize: 24, color: Colors.textDisabled },
})
