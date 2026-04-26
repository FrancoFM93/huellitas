import { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Colors } from '@/constants/colors'

type Message = {
  id: string
  thread_id: string
  sender_id: string
  body: string
  read_at: string | null
  created_at: string
}

export default function VetThread() {
  const { t } = useTranslation()
  const { threadId } = useLocalSearchParams<{ threadId: string }>()
  const { profile } = useAuthStore()
  const qc = useQueryClient()
  const listRef = useRef<FlatList<Message>>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const threadQuery = useQuery({
    queryKey: ['vet-thread', threadId],
    queryFn: async () => {
      const { data } = await supabase
        .from('vet_threads')
        .select(`
          *,
          owner:profiles!owner_id(id,name,avatar_url),
          vet:profiles!vet_id(id,name,avatar_url,type),
          pet:pets(id,name)
        `)
        .eq('id', threadId)
        .single()
      return data as any
    },
  })

  const messagesQuery = useQuery({
    queryKey: ['vet-messages', threadId],
    queryFn: async () => {
      const { data } = await supabase
        .from('vet_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true })
      return (data ?? []) as Message[]
    },
  })

  // Mark counterparty messages as read on open
  useEffect(() => {
    if (!profile || !messagesQuery.data) return
    const toRead = messagesQuery.data.filter((m) => m.read_at == null && m.sender_id !== profile.id)
    if (toRead.length === 0) return
    supabase
      .from('vet_messages')
      .update({ read_at: new Date().toISOString() })
      .in('id', toRead.map((m) => m.id))
      .then(() => qc.invalidateQueries({ queryKey: ['vet-threads', profile.id] }))
  }, [messagesQuery.data, profile?.id])

  // Realtime: append new messages live
  useEffect(() => {
    if (!threadId) return
    const channel = supabase
      .channel(`vet_messages:${threadId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'vet_messages', filter: `thread_id=eq.${threadId}` },
        () => qc.invalidateQueries({ queryKey: ['vet-messages', threadId] })
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [threadId])

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if ((messagesQuery.data?.length ?? 0) > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50)
    }
  }, [messagesQuery.data?.length])

  const send = async () => {
    const body = draft.trim()
    if (!body || !profile || sending) return
    setSending(true)
    setDraft('')
    const { error } = await supabase
      .from('vet_messages')
      .insert({ thread_id: threadId, sender_id: profile.id, body })
    setSending(false)
    if (error) {
      setDraft(body)
      return
    }
    qc.invalidateQueries({ queryKey: ['vet-messages', threadId] })
  }

  if (threadQuery.isLoading || !threadQuery.data) {
    return <View style={styles.loader}><ActivityIndicator color={Colors.primary} /></View>
  }

  const thread = threadQuery.data
  const counterparty = thread.owner_id === profile?.id ? thread.vet : thread.owner

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>{t('profile.back')}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.topBarTitle} numberOfLines={1}>{counterparty?.name ?? t('messages.thread_title')}</Text>
          {thread.pet && <Text style={styles.topBarSub} numberOfLines={1}>🐾 {thread.pet.name}</Text>}
        </View>
        <View style={{ width: 60 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        style={{ flex: 1 }}
      >
        <FlatList
          ref={listRef}
          data={messagesQuery.data ?? []}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const mine = item.sender_id === profile?.id
            return (
              <View style={[styles.bubbleRow, mine ? styles.bubbleRight : styles.bubbleLeft]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={[styles.bubbleText, mine && { color: Colors.white }]}>{item.body}</Text>
                  <Text style={[styles.bubbleTime, mine && { color: 'rgba(255,255,255,0.7)' }]}>
                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
            )
          }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder={t('messages.input_placeholder')}
            placeholderTextColor={Colors.textDisabled}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
            onPress={send}
            disabled={!draft.trim() || sending}
          >
            {sending
              ? <ActivityIndicator color={Colors.white} size="small" />
              : <Text style={styles.sendBtnText}>{t('messages.send')}</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backText: { color: Colors.primary, fontSize: 15, fontWeight: '500', width: 60 },
  topBarTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  topBarSub: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  list: { padding: 14, gap: 8, paddingBottom: 16 },
  bubbleRow: { flexDirection: 'row' },
  bubbleLeft: { justifyContent: 'flex-start' },
  bubbleRight: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '78%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9,
  },
  bubbleMine: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, color: Colors.text, lineHeight: 19 },
  bubbleTime: { fontSize: 10, color: Colors.textMuted, marginTop: 4, alignSelf: 'flex-end' },
  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  input: {
    flex: 1, backgroundColor: Colors.borderLight, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: Colors.text,
    maxHeight: 110,
  },
  sendBtn: {
    backgroundColor: Colors.primary, borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 10,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: Colors.white, fontSize: 14, fontWeight: '700' },
})
