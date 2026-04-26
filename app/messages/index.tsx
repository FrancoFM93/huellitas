import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Colors } from '@/constants/colors'

type ThreadRow = {
  id: string
  owner_id: string
  vet_id: string
  pet_id: string | null
  last_message_at: string
  last_message_preview: string | null
  owner: { id: string; name: string; avatar_url: string | null } | null
  vet:   { id: string; name: string; avatar_url: string | null; type: string } | null
  pet:   { id: string; name: string } | null
  unread: number
}

export default function MessagesInbox() {
  const { profile } = useAuthStore()
  const [refreshing, setRefreshing] = useState(false)

  const threadsQuery = useQuery({
    queryKey: ['vet-threads', profile?.id],
    queryFn: async () => {
      const { data: threads } = await supabase
        .from('vet_threads')
        .select(`
          id, owner_id, vet_id, pet_id, last_message_at, last_message_preview,
          owner:profiles!owner_id(id,name,avatar_url),
          vet:profiles!vet_id(id,name,avatar_url,type),
          pet:pets(id,name)
        `)
        .or(`owner_id.eq.${profile!.id},vet_id.eq.${profile!.id}`)
        .order('last_message_at', { ascending: false })
        .limit(80)

      const list = (threads ?? []) as any[]
      const ids = list.map((t) => t.id)
      if (ids.length === 0) return [] as ThreadRow[]

      const { data: msgs } = await supabase
        .from('vet_messages')
        .select('thread_id,sender_id,read_at')
        .in('thread_id', ids)
        .is('read_at', null)

      const unreadByThread: Record<string, number> = {}
      ;(msgs ?? []).forEach((m: any) => {
        if (m.sender_id !== profile!.id) {
          unreadByThread[m.thread_id] = (unreadByThread[m.thread_id] ?? 0) + 1
        }
      })

      return list.map<ThreadRow>((t) => ({ ...t, unread: unreadByThread[t.id] ?? 0 }))
    },
    enabled: !!profile,
  })

  const threads = threadsQuery.data ?? []

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await threadsQuery.refetch()
    setRefreshing(false)
  }, [threadsQuery])

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Mensajes</Text>
        <View style={{ width: 60 }} />
      </View>

      {threadsQuery.isLoading ? (
        <View style={styles.loader}><ActivityIndicator color={Colors.primary} /></View>
      ) : threads.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.emptyTitle}>Sin conversaciones</Text>
          <Text style={styles.emptyHint}>
            Iniciá una consulta tocando "Mensaje" en el perfil de un veterinario.
          </Text>
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.inner}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          renderItem={({ item }) => {
            const isOwner = item.owner_id === profile?.id
            const counterparty = isOwner ? item.vet : item.owner
            const isVet = isOwner
            return (
              <TouchableOpacity
                style={styles.row}
                onPress={() => router.push(`/messages/${item.id}`)}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {isVet ? '🩺' : (counterparty?.name?.[0]?.toUpperCase() ?? '?')}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{counterparty?.name ?? 'Conversación'}</Text>
                  {item.pet && (
                    <Text style={styles.rowPet}>🐾 {item.pet.name}</Text>
                  )}
                  <Text style={styles.rowPreview} numberOfLines={2}>
                    {item.last_message_preview ?? 'Sin mensajes'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Text style={styles.rowTime}>{formatTime(item.last_message_at)}</Text>
                  {item.unread > 0 && (
                    <View style={styles.unreadDot}>
                      <Text style={styles.unreadText}>{item.unread}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            )
          }}
        />
      )}
    </SafeAreaView>
  )
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString()
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
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 8 },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  emptyHint: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 18 },
  inner: { padding: 14, gap: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 22 },
  rowName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  rowPet: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  rowPreview: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, lineHeight: 17 },
  rowTime: { fontSize: 11, color: Colors.textMuted },
  unreadDot: {
    minWidth: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.primary, paddingHorizontal: 7,
    justifyContent: 'center', alignItems: 'center',
  },
  unreadText: { color: Colors.white, fontSize: 11, fontWeight: '800' },
})
