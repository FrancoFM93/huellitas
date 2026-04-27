import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
  Alert, Image, Linking,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { usePhotoUpload } from '@/lib/usePhotoUpload'
import { Colors } from '@/constants/colors'

export default function MonitoringSession() {
  const { t } = useTranslation()
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const { profile } = useAuthStore()
  const qc = useQueryClient()
  const { upload, uploading } = usePhotoUpload()
  const [note, setNote] = useState('')

  const TYPE_LABEL: Record<string, { icon: string; label: string }> = {
    photo: { icon: '📷', label: t('monitoring.type_photo') },
    video: { icon: '🎥', label: t('monitoring.type_video') },
  }
  const STATUS_LABEL: Record<string, { text: string; color: string }> = {
    scheduled: { text: t('contract.session_scheduled'), color: Colors.warning },
    completed: { text: t('contract.session_completed'), color: Colors.success },
    missed:    { text: t('contract.session_missed'), color: Colors.alert },
  }

  const { data: session, isLoading } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: async () => {
      const { data } = await supabase
        .from('monitoring_sessions')
        .select('*, contract:adoption_contracts(*, post:adoption_posts(name,species))')
        .eq('id', sessionId)
        .single()
      return data as any
    },
  })

  const addPhoto = useMutation({
    mutationFn: async () => {
      const url = await upload({ folder: 'monitoring' })
      if (!url) return null
      const next = [...(session.photo_urls ?? []), url]
      const { error } = await supabase
        .from('monitoring_sessions')
        .update({ photo_urls: next })
        .eq('id', sessionId)
      if (error) throw error
      return url
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['session', sessionId] }),
    onError: (e: Error) => Alert.alert(t('common.error'), e.message),
  })

  const setJitsiRoom = useMutation({
    mutationFn: async () => {
      const room = `huellitas-${session.contract_id.slice(0, 8)}-${sessionId.slice(0, 8)}`
      const { error } = await supabase
        .from('monitoring_sessions')
        .update({ jitsi_room: room })
        .eq('id', sessionId)
      if (error) throw error
      return room
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['session', sessionId] }),
    onError: (e: Error) => Alert.alert(t('common.error'), e.message),
  })

  const verify = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('fn_verify_session', {
        session_id: sessionId,
        note: note.trim() || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['session', sessionId] })
      qc.invalidateQueries({ queryKey: ['sessions'] })
      Alert.alert(t('monitoring.verified_title'), t('monitoring.verified_msg'))
    },
    onError: (e: Error) => Alert.alert(t('common.error'), e.message),
  })

  if (isLoading || !session) {
    return (
      <View style={styles.loader}><ActivityIndicator color={Colors.primary} /></View>
    )
  }

  const contract = session.contract
  const isAdopter = profile?.id === contract?.adopter_id
  const isPoster  = profile?.id === contract?.poster_id
  const type = TYPE_LABEL[session.type]
  const status = STATUS_LABEL[session.status]
  const scheduled = new Date(session.scheduled_at)
  const photos: string[] = session.photo_urls ?? []
  const isScheduled = session.status === 'scheduled'
  const hasContent = photos.length > 0 || !!session.jitsi_room

  const openJitsi = () => {
    const room = session.jitsi_room
    if (!room) return
    Linking.openURL(`https://meet.jit.si/${room}`)
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>{t('profile.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{t('monitoring.title')}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.inner}>
        <View style={styles.hero}>
          <Text style={styles.heroIcon}>{type?.icon ?? '📋'}</Text>
          <Text style={styles.heroTitle}>{type?.label ?? session.type}</Text>
          <Text style={styles.heroPet}>{contract?.post?.name ?? t('contract.pet_fallback')}</Text>
          <View style={styles.statusPill}>
            <Text style={[styles.statusPillText, { color: status?.color ?? Colors.textMuted }]}>
              {status?.text ?? session.status}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('monitoring.scheduled_date')}</Text>
          <Text style={styles.cardValue}>{scheduled.toLocaleDateString()}</Text>
        </View>

        {session.type === 'photo' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('monitoring.photos_count', { count: photos.length })}</Text>
            {photos.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                {photos.map((url) => (
                  <Image key={url} source={{ uri: url }} style={styles.photo} />
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.empty}>{t('monitoring.no_photos')}</Text>
            )}
            {isAdopter && isScheduled && (
              <TouchableOpacity
                style={[styles.btn, uploading && styles.btnDisabled]}
                onPress={() => addPhoto.mutate()}
                disabled={uploading}
              >
                {uploading
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={styles.btnText}>{t('monitoring.upload_photo')}</Text>}
              </TouchableOpacity>
            )}
          </View>
        )}

        {session.type === 'video' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('monitoring.video_call')}</Text>
            {session.jitsi_room ? (
              <>
                <Text style={styles.cardValue}>{t('monitoring.room_label', { room: session.jitsi_room })}</Text>
                <TouchableOpacity style={styles.btn} onPress={openJitsi}>
                  <Text style={styles.btnText}>{t('monitoring.join_room')}</Text>
                </TouchableOpacity>
              </>
            ) : isAdopter && isScheduled ? (
              <TouchableOpacity
                style={styles.btn}
                onPress={() => setJitsiRoom.mutate()}
              >
                <Text style={styles.btnText}>{t('monitoring.create_room')}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.empty}>{t('monitoring.no_room_yet')}</Text>
            )}
          </View>
        )}

        {isPoster && isScheduled && hasContent && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('monitoring.verification')}</Text>
            <Text style={styles.cardHint}>{t('monitoring.verification_hint')}</Text>
            <TouchableOpacity
              style={[styles.btn, styles.btnSuccess]}
              onPress={() =>
                Alert.alert(t('monitoring.verify_alert_title'), t('monitoring.verify_alert_msg'), [
                  { text: t('common.cancel'), style: 'cancel' },
                  { text: t('monitoring.verify_btn'), onPress: () => verify.mutate() },
                ])
              }
            >
              <Text style={styles.btnText}>{t('monitoring.mark_completed')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {session.status === 'completed' && session.notes && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('monitoring.notes_title')}</Text>
            <Text style={styles.cardValue}>{session.notes}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backText: { color: Colors.primary, fontSize: 15, fontWeight: '500' },
  topBarTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  inner: { padding: 20, gap: 14, paddingBottom: 48 },
  hero: { alignItems: 'center', gap: 6 },
  heroIcon: { fontSize: 56 },
  heroTitle: { fontSize: 20, fontWeight: '800', color: Colors.text },
  heroPet: { fontSize: 14, color: Colors.textSecondary },
  statusPill: {
    backgroundColor: Colors.surface, borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 5, marginTop: 4,
  },
  statusPillText: { fontSize: 13, fontWeight: '700' },
  card: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14, gap: 6,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardTitle: { fontSize: 13, color: Colors.textMuted, fontWeight: '700', textTransform: 'uppercase' },
  cardValue: { fontSize: 15, color: Colors.text, fontWeight: '600' },
  cardHint: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  empty: { fontSize: 13, color: Colors.textMuted, fontStyle: 'italic' },
  photo: { width: 120, height: 120, borderRadius: 10, marginRight: 8 },
  btn: {
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  btnSuccess: { backgroundColor: Colors.success },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
})
