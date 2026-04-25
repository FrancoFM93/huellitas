import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
  Alert, Image, Linking,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { usePhotoUpload } from '@/lib/usePhotoUpload'
import { Colors } from '@/constants/colors'

const TYPE_LABEL: Record<string, { icon: string; label: string }> = {
  photo: { icon: '📷', label: 'Sesión de fotos' },
  video: { icon: '🎥', label: 'Videollamada' },
}

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  scheduled: { text: '⏳ Programada', color: Colors.warning },
  completed: { text: '✅ Completada', color: Colors.success },
  missed:    { text: '❌ No realizada', color: Colors.alert },
}

export default function MonitoringSession() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const { profile } = useAuthStore()
  const qc = useQueryClient()
  const { upload, uploading } = usePhotoUpload()
  const [note, setNote] = useState('')

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
    onError: (e: Error) => Alert.alert('Error', e.message),
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
    onError: (e: Error) => Alert.alert('Error', e.message),
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
      Alert.alert('Verificada', 'Sesión marcada como completada.')
    },
    onError: (e: Error) => Alert.alert('Error', e.message),
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
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Sesión</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.inner}>
        <View style={styles.hero}>
          <Text style={styles.heroIcon}>{type?.icon ?? '📋'}</Text>
          <Text style={styles.heroTitle}>{type?.label ?? session.type}</Text>
          <Text style={styles.heroPet}>{contract?.post?.name ?? 'Mascota'}</Text>
          <View style={styles.statusPill}>
            <Text style={[styles.statusPillText, { color: status?.color ?? Colors.textMuted }]}>
              {status?.text ?? session.status}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fecha programada</Text>
          <Text style={styles.cardValue}>{scheduled.toLocaleDateString()}</Text>
        </View>

        {session.type === 'photo' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Fotos ({photos.length})</Text>
            {photos.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                {photos.map((url) => (
                  <Image key={url} source={{ uri: url }} style={styles.photo} />
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.empty}>Aún no hay fotos cargadas</Text>
            )}
            {isAdopter && isScheduled && (
              <TouchableOpacity
                style={[styles.btn, uploading && styles.btnDisabled]}
                onPress={() => addPhoto.mutate()}
                disabled={uploading}
              >
                {uploading
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={styles.btnText}>📷 Subir foto</Text>}
              </TouchableOpacity>
            )}
          </View>
        )}

        {session.type === 'video' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Videollamada</Text>
            {session.jitsi_room ? (
              <>
                <Text style={styles.cardValue}>Sala: {session.jitsi_room}</Text>
                <TouchableOpacity style={styles.btn} onPress={openJitsi}>
                  <Text style={styles.btnText}>🎥 Unirse a la sala</Text>
                </TouchableOpacity>
              </>
            ) : isAdopter && isScheduled ? (
              <TouchableOpacity
                style={styles.btn}
                onPress={() => setJitsiRoom.mutate()}
              >
                <Text style={styles.btnText}>Crear sala de videollamada</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.empty}>El adoptante aún no creó la sala</Text>
            )}
          </View>
        )}

        {isPoster && isScheduled && hasContent && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Verificación</Text>
            <Text style={styles.cardHint}>
              Confirmá que la sesión se realizó correctamente y la mascota está bien.
            </Text>
            <TouchableOpacity
              style={[styles.btn, styles.btnSuccess]}
              onPress={() =>
                Alert.alert('Verificar sesión', '¿Confirmás que esta sesión se completó?', [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Verificar', onPress: () => verify.mutate() },
                ])
              }
            >
              <Text style={styles.btnText}>✅ Marcar como completada</Text>
            </TouchableOpacity>
          </View>
        )}

        {session.status === 'completed' && session.notes && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Notas del verificador</Text>
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
