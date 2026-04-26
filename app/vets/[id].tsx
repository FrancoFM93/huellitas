import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Linking, Alert,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Colors } from '@/constants/colors'
import type { VetWithProfile } from '@/types'

const DAY_LABELS: Record<string, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  sunday: 'Domingo',
}

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

export default function VetDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { profile: me } = useAuthStore()

  const { data: vet, isLoading } = useQuery({
    queryKey: ['vet', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('vet_profiles')
        .select('*, profile:profiles(*)')
        .eq('id', id)
        .single()
      return data as VetWithProfile
    },
  })

  if (isLoading || !vet) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    )
  }

  const profile = vet.profile
  const schedule = vet.schedule as Record<string, { open: string; close: string; closed: boolean }> | null

  const openPhone = () => {
    const num = vet.phone ?? profile?.phone
    if (num) Linking.openURL(`tel:${num}`)
  }

  const openWhatsapp = () => {
    const num = (vet.phone ?? profile?.phone ?? '').replace(/\D/g, '')
    if (num) Linking.openURL(`https://wa.me/${num}`)
  }

  const openEmail = () => {
    if (vet.email) Linking.openURL(`mailto:${vet.email}`)
  }

  const openWebsite = () => {
    if (vet.website) Linking.openURL(vet.website)
  }

  const startMessage = async () => {
    if (!me || !me.id) {
      Alert.alert('Inicio de sesión', 'Necesitás una cuenta para enviar mensajes.')
      return
    }
    const vetProfileId = (vet.profile as any)?.id
    if (!vetProfileId) return
    if (vetProfileId === me.id) {
      Alert.alert('No disponible', 'No podés iniciar una conversación con vos mismo.')
      return
    }
    const { data: existing } = await supabase
      .from('vet_threads')
      .select('id')
      .eq('owner_id', me.id)
      .eq('vet_id', vetProfileId)
      .is('pet_id', null)
      .maybeSingle()
    let threadId = existing?.id
    if (!threadId) {
      const { data: created, error } = await supabase
        .from('vet_threads')
        .insert({ owner_id: me.id, vet_id: vetProfileId, pet_id: null })
        .select('id')
        .single()
      if (error || !created) {
        Alert.alert('Error', error?.message ?? 'No se pudo iniciar la conversación')
        return
      }
      threadId = created.id
    }
    router.push(`/messages/${threadId}`)
  }

  const hasPhone = !!(vet.phone ?? profile?.phone)
  const hasContact = hasPhone || !!vet.email || !!vet.website

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarIcon}>🩺</Text>
          </View>

          <View style={[
            styles.availBadge,
            { backgroundColor: vet.available ? Colors.successLight : Colors.border },
          ]}>
            <View style={[
              styles.availDot,
              { backgroundColor: vet.available ? Colors.success : Colors.textDisabled },
            ]} />
            <Text style={[
              styles.availText,
              { color: vet.available ? Colors.success : Colors.textMuted },
            ]}>
              {vet.available ? 'Disponible ahora' : 'No disponible'}
            </Text>
          </View>

          <Text style={styles.name}>{profile?.name ?? 'Veterinario'}</Text>
          <Text style={styles.license}>Mat. {vet.license_number}</Text>

          {vet.specialties?.length > 0 && (
            <View style={styles.specialtiesRow}>
              {vet.specialties.map((s) => (
                <View key={s} style={styles.specialtyChip}>
                  <Text style={styles.specialtyText}>{s}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Fee */}
        {vet.consultation_fee != null && (
          <View style={styles.feeCard}>
            <Text style={styles.feeIcon}>💵</Text>
            <View>
              <Text style={styles.feeLabel}>Consulta</Text>
              <Text style={styles.feeAmount}>${vet.consultation_fee.toLocaleString('es-AR')}</Text>
            </View>
          </View>
        )}

        {/* Bio */}
        {profile?.bio && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sobre el/la veterinario/a</Text>
            <Text style={styles.cardText}>{profile.bio}</Text>
          </View>
        )}

        {/* Schedule */}
        {schedule && Object.keys(schedule).length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Horario de atención</Text>
            {DAY_ORDER.filter((d) => schedule[d]).map((day) => {
              const s = schedule[day]
              return (
                <View key={day} style={styles.scheduleRow}>
                  <Text style={styles.scheduleDay}>{DAY_LABELS[day]}</Text>
                  {s.closed
                    ? <Text style={styles.scheduleClosed}>Cerrado</Text>
                    : <Text style={styles.scheduleHours}>{s.open} – {s.close}</Text>
                  }
                </View>
              )
            })}
          </View>
        )}

        {/* Contact */}
        <TouchableOpacity style={styles.messageBtn} onPress={startMessage}>
          <Text style={styles.messageBtnText}>💬 Enviar mensaje</Text>
        </TouchableOpacity>

        {hasContact && (
          <View style={styles.contactSection}>
            <Text style={styles.contactTitle}>Contacto</Text>
            <View style={styles.contactBtns}>
              {hasPhone && (
                <TouchableOpacity style={styles.contactBtn} onPress={openPhone}>
                  <Text style={styles.contactBtnText}>📞 Llamar</Text>
                </TouchableOpacity>
              )}
              {hasPhone && (
                <TouchableOpacity style={[styles.contactBtn, styles.whatsappBtn]} onPress={openWhatsapp}>
                  <Text style={styles.contactBtnText}>💬 WhatsApp</Text>
                </TouchableOpacity>
              )}
              {vet.email && (
                <TouchableOpacity style={[styles.contactBtn, styles.emailBtn]} onPress={openEmail}>
                  <Text style={styles.contactBtnText}>✉️ Email</Text>
                </TouchableOpacity>
              )}
              {vet.website && (
                <TouchableOpacity style={[styles.contactBtn, styles.webBtn]} onPress={openWebsite}>
                  <Text style={styles.contactBtnText}>🌐 Sitio web</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backText: { color: Colors.primary, fontSize: 15, fontWeight: '500' },
  inner: { padding: 20, gap: 16, paddingBottom: 48 },

  hero: { alignItems: 'center', gap: 10 },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarIcon: { fontSize: 52 },
  availBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 5,
  },
  availDot: { width: 7, height: 7, borderRadius: 4 },
  availText: { fontSize: 13, fontWeight: '600' },
  name: { fontSize: 26, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  license: { fontSize: 13, color: Colors.textMuted },
  specialtiesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  specialtyChip: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  specialtyText: { fontSize: 12, color: Colors.primaryDark, fontWeight: '600' },

  feeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  feeIcon: { fontSize: 28 },
  feeLabel: { fontSize: 12, color: Colors.textMuted },
  feeAmount: { fontSize: 22, fontWeight: '800', color: Colors.primary },

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

  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  scheduleDay: { fontSize: 14, color: Colors.text, fontWeight: '500' },
  scheduleHours: { fontSize: 14, color: Colors.textSecondary },
  scheduleClosed: { fontSize: 14, color: Colors.textDisabled },

  contactSection: { gap: 10 },
  contactTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  contactBtns: { gap: 10 },
  contactBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  whatsappBtn: { backgroundColor: '#25D366' },
  emailBtn: { backgroundColor: Colors.info },
  webBtn: { backgroundColor: Colors.textSecondary },
  contactBtnText: { color: Colors.white, fontSize: 14, fontWeight: '700' },
  messageBtn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  messageBtnText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
})
