import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Linking,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Colors } from '@/constants/colors'
import type { ClinicWithProfile } from '@/types'

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

export default function ClinicDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()

  const { data: clinic, isLoading } = useQuery({
    queryKey: ['clinic', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('clinic_profiles')
        .select('*, profile:profiles(*)')
        .eq('id', id)
        .single()
      return data as ClinicWithProfile
    },
  })

  if (isLoading || !clinic) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    )
  }

  const profile = clinic.profile
  const schedule = clinic.schedule as Record<string, { open: string; close: string; closed: boolean }> | null

  const openPhone = () => Linking.openURL(`tel:${clinic.phone}`)
  const openEmail = () => { if (clinic.email) Linking.openURL(`mailto:${clinic.email}`) }
  const openWebsite = () => { if (clinic.website) Linking.openURL(clinic.website) }
  const openMaps = () => {
    const query = encodeURIComponent(clinic.address)
    Linking.openURL(`https://maps.google.com/?q=${query}`)
  }

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
            <Text style={styles.avatarIcon}>🏥</Text>
          </View>

          {clinic.emergency_24h && (
            <View style={styles.emergencyBadge}>
              <Text style={styles.emergencyBadgeText}>🚨 Emergencias 24hs</Text>
            </View>
          )}

          <Text style={styles.name}>{profile?.name ?? 'Clínica'}</Text>

          <TouchableOpacity style={styles.addressRow} onPress={openMaps} activeOpacity={0.7}>
            <Text style={styles.addressText}>📍 {clinic.address}</Text>
            <Text style={styles.mapsLink}>Ver mapa</Text>
          </TouchableOpacity>
        </View>

        {/* Services */}
        {clinic.services?.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Servicios</Text>
            <View style={styles.servicesGrid}>
              {clinic.services.map((s) => (
                <View key={s} style={styles.serviceChip}>
                  <Text style={styles.serviceText}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Bio */}
        {profile?.bio && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sobre la clínica</Text>
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
        <View style={styles.contactSection}>
          <Text style={styles.contactTitle}>Contacto</Text>
          <View style={styles.contactBtns}>
            <TouchableOpacity style={styles.contactBtn} onPress={openPhone}>
              <Text style={styles.contactBtnText}>📞 Llamar</Text>
            </TouchableOpacity>
            {clinic.email && (
              <TouchableOpacity style={[styles.contactBtn, styles.emailBtn]} onPress={openEmail}>
                <Text style={styles.contactBtnText}>✉️ Email</Text>
              </TouchableOpacity>
            )}
            {clinic.website && (
              <TouchableOpacity style={[styles.contactBtn, styles.webBtn]} onPress={openWebsite}>
                <Text style={styles.contactBtnText}>🌐 Sitio web</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.contactBtn, styles.mapsBtn]} onPress={openMaps}>
              <Text style={styles.contactBtnText}>🗺️ Cómo llegar</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    backgroundColor: Colors.infoLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarIcon: { fontSize: 52 },
  emergencyBadge: {
    backgroundColor: Colors.alertLight,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  emergencyBadgeText: { color: Colors.alert, fontSize: 13, fontWeight: '700' },
  name: { fontSize: 26, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addressText: { fontSize: 13, color: Colors.textMuted, flexShrink: 1 },
  mapsLink: { fontSize: 13, color: Colors.primary, fontWeight: '600' },

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

  servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  serviceChip: {
    backgroundColor: Colors.infoLight,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  serviceText: { fontSize: 12, color: Colors.info, fontWeight: '600' },

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
  emailBtn: { backgroundColor: Colors.info },
  webBtn: { backgroundColor: Colors.textSecondary },
  mapsBtn: { backgroundColor: Colors.primaryDark },
  contactBtnText: { color: Colors.white, fontSize: 14, fontWeight: '700' },
})
