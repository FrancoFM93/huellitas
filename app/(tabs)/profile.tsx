import { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, Alert, ScrollView, Switch,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useNotificationStore } from '@/store/notificationStore'
import { changeLanguage } from '@/lib/i18n'
import { Colors } from '@/constants/colors'
import type { Pet, AppNotification } from '@/types'

const SPECIES_ICONS: Record<string, string> = {
  dog: '🐶', cat: '🐱', bird: '🐦', rabbit: '🐰', other: '🐾',
}

async function fetchMyPets(ownerId: string): Promise<Pet[]> {
  const { data } = await supabase
    .from('pets')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
  return (data ?? []) as Pet[]
}

function PetCard({ pet }: { pet: Pet }) {
  return (
    <TouchableOpacity
      style={styles.petCard}
      onPress={() => router.push(`/pets/${pet.id}`)}
      activeOpacity={0.8}
    >
      <View style={styles.petAvatar}>
        <Text style={styles.petAvatarIcon}>{SPECIES_ICONS[pet.species]}</Text>
        {pet.is_missing && (
          <View style={styles.missingIndicator}>
            <Text style={styles.missingIndicatorText}>!</Text>
          </View>
        )}
      </View>
      <Text style={styles.petName} numberOfLines={1}>{pet.name}</Text>
      <Text style={styles.petBreed} numberOfLines={1}>{pet.breed ?? pet.species}</Text>
    </TouchableOpacity>
  )
}

function NotifItem({ item }: { item: AppNotification }) {
  const { markRead } = useNotificationStore()
  const TYPE_ICONS: Record<string, string> = {
    missing_pet_near_you: '🔍',
    pet_sighting: '👀',
    community_alert: '🚨',
    alert_response: '🤝',
    donation_received: '💚',
    fundraiser_update: '📢',
    vet_message: '🩺',
    new_fundraiser: '💰',
  }

  return (
    <TouchableOpacity
      style={[styles.notifItem, !item.read && styles.notifItemUnread]}
      onPress={() => markRead(item.id)}
    >
      <Text style={styles.notifIcon}>{TYPE_ICONS[item.type] ?? '🔔'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.notifTitle}>{item.title}</Text>
        <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
      </View>
      {!item.read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  )
}

export default function Profile() {
  const { t, i18n } = useTranslation()
  const { profile, vetProfile, clinicProfile, setVetProfile, signOut, session } = useAuthStore()
  const { notifications, unreadCount, fetchNotifications, markAllRead } = useNotificationStore()
  // Local toggle state mirrors vetProfile.available for instant UI feedback
  const [available, setAvailable] = useState(vetProfile?.available ?? false)

  const handleToggleAvailability = async (value: boolean) => {
    if (!vetProfile) return
    setAvailable(value) // optimistic update
    const { error } = await supabase
      .from('vet_profiles')
      .update({ available: value })
      .eq('profile_id', profile!.id)
    if (error) {
      setAvailable(!value) // revert on failure
      Alert.alert('Error', 'No se pudo actualizar la disponibilidad')
    } else {
      setVetProfile({ ...vetProfile, available: value })
    }
  }

  useEffect(() => {
    if (session?.user) fetchNotifications(session.user.id)
  }, [session?.user])

  const { data: pets, isLoading: petsLoading } = useQuery({
    queryKey: ['my-pets', profile?.id],
    queryFn: () => fetchMyPets(profile!.id),
    enabled: !!profile && profile.type === 'user',
  })

  const handleSignOut = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: signOut },
    ])
  }

  if (!profile) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    )
  }

  const typeLabel = profile.type === 'user' ? t('profile.owner') : profile.type === 'vet' ? t('profile.vet') : t('profile.clinic')
  const typeIcon = profile.type === 'user' ? '🏠' : profile.type === 'vet' ? '🩺' : '🏥'

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarEmoji}>{typeIcon}</Text>
          </View>
          <Text style={styles.profileName}>{profile.name}</Text>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{typeLabel}</Text>
          </View>
          {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
        </View>

        {/* Vet info */}
        {profile.type === 'vet' && vetProfile && (
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Información Profesional</Text>
            <InfoRow label="Matrícula" value={vetProfile.license_number} />
            {vetProfile.phone && <InfoRow label="Teléfono" value={vetProfile.phone} />}
            {vetProfile.consultation_fee && (
              <InfoRow label="Consulta" value={`$${vetProfile.consultation_fee}`} />
            )}
            {vetProfile.specialties?.length > 0 && (
              <InfoRow label="Especialidades" value={vetProfile.specialties.join(', ')} />
            )}
            <View style={styles.availRow}>
              <View>
                <Text style={styles.infoLabel}>Disponible para consultas</Text>
                <Text style={[styles.availStatus, { color: available ? Colors.success : Colors.textMuted }]}>
                  {available ? 'Activo — visible en el directorio' : 'Inactivo — oculto del directorio'}
                </Text>
              </View>
              <Switch
                value={available}
                onValueChange={handleToggleAvailability}
                trackColor={{ true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>
          </View>
        )}

        {/* Clinic info */}
        {profile.type === 'clinic' && clinicProfile && (
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Datos de la Clínica</Text>
            <InfoRow label="Dirección" value={clinicProfile.address} />
            <InfoRow label="Teléfono" value={clinicProfile.phone} />
            {clinicProfile.email && <InfoRow label="Email" value={clinicProfile.email} />}
            {clinicProfile.services?.length > 0 && (
              <InfoRow label="Servicios" value={clinicProfile.services.join(', ')} />
            )}
            {clinicProfile.emergency_24h && (
              <View style={styles.emergencyBadge}>
                <Text style={styles.emergencyBadgeText}>🚨 Atención de emergencias 24hs</Text>
              </View>
            )}
          </View>
        )}

        {/* Pets section (users only) */}
        {profile.type === 'user' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Mis Mascotas</Text>
              <TouchableOpacity onPress={() => router.push('/pets/new')}>
                <Text style={styles.sectionAction}>+ Agregar</Text>
              </TouchableOpacity>
            </View>
            {petsLoading ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (pets?.length ?? 0) === 0 ? (
              <TouchableOpacity style={styles.addPetCard} onPress={() => router.push('/pets/new')}>
                <Text style={styles.addPetIcon}>🐾</Text>
                <Text style={styles.addPetText}>Agrega tu primera mascota</Text>
              </TouchableOpacity>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.petsRow}>
                {(pets ?? []).map((p) => <PetCard key={p.id} pet={p} />)}
                <TouchableOpacity style={styles.addPetBubble} onPress={() => router.push('/pets/new')}>
                  <Text style={styles.addBubbleText}>+</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        )}

        {/* Notifications */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Notificaciones {unreadCount > 0 && `(${unreadCount})`}
            </Text>
            {unreadCount > 0 && (
              <TouchableOpacity onPress={markAllRead}>
                <Text style={styles.sectionAction}>Leer todo</Text>
              </TouchableOpacity>
            )}
          </View>
          {notifications.length === 0 ? (
            <Text style={styles.emptyNotif}>Sin notificaciones</Text>
          ) : (
            <View>
              {notifications.slice(0, 10).map((n) => <NotifItem key={n.id} item={n} />)}
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push('/profile/edit')}
          >
            <Text style={styles.actionIcon}>✏️</Text>
            <Text style={styles.actionText}>{t('profile.edit_profile')}</Text>
          </TouchableOpacity>

          {/* Language picker */}
          <View style={styles.actionBtn}>
            <Text style={styles.actionIcon}>🌐</Text>
            <Text style={styles.actionText}>{t('profile.language')}</Text>
            <View style={styles.langBtns}>
              <TouchableOpacity
                style={[styles.langBtn, i18n.language === 'es' && styles.langBtnActive]}
                onPress={() => changeLanguage('es')}
              >
                <Text style={[styles.langBtnText, i18n.language === 'es' && styles.langBtnTextActive]}>
                  {t('profile.language_es')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.langBtn, i18n.language === 'en' && styles.langBtnActive]}
                onPress={() => changeLanguage('en')}
              >
                <Text style={[styles.langBtnText, i18n.language === 'en' && styles.langBtnTextActive]}>
                  {t('profile.language_en')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={[styles.actionBtn, styles.signOutBtn]} onPress={handleSignOut}>
            <Text style={styles.actionIcon}>🚪</Text>
            <Text style={[styles.actionText, { color: Colors.alert }]}>{t('common.sign_out')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  profileHeader: {
    backgroundColor: Colors.surface,
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  avatarContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  avatarEmoji: { fontSize: 36 },
  profileName: { fontSize: 22, fontWeight: '800', color: Colors.text },
  typeBadge: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  typeBadgeText: { color: Colors.primaryDark, fontSize: 13, fontWeight: '600' },
  bio: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18 },
  infoCard: {
    margin: 16,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  infoCardTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  infoLabel: { fontSize: 13, color: Colors.textMuted, flex: 1 },
  infoValue: { fontSize: 13, color: Colors.text, flex: 2, textAlign: 'right', fontWeight: '500' },
  availRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  availStatus: { fontSize: 11, marginTop: 2 },
  emergencyBadge: { backgroundColor: Colors.alertLight, borderRadius: 10, padding: 10 },
  emergencyBadgeText: { color: Colors.alert, fontSize: 13, fontWeight: '600' },
  section: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  sectionAction: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  petsRow: { marginHorizontal: -4 },
  petCard: {
    width: 80,
    alignItems: 'center',
    gap: 4,
    marginHorizontal: 4,
  },
  petAvatar: { position: 'relative' },
  petAvatarIcon: { fontSize: 44 },
  missingIndicator: {
    position: 'absolute',
    top: 0,
    right: -2,
    backgroundColor: Colors.warning,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  missingIndicatorText: { color: Colors.white, fontSize: 10, fontWeight: '700' },
  petName: { fontSize: 12, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  petBreed: { fontSize: 10, color: Colors.textMuted, textAlign: 'center' },
  addPetCard: {
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    paddingVertical: 24,
    alignItems: 'center',
    gap: 6,
  },
  addPetIcon: { fontSize: 32 },
  addPetText: { fontSize: 13, color: Colors.textMuted },
  addPetBubble: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  addBubbleText: { fontSize: 28, color: Colors.textMuted },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 6,
  },
  notifItemUnread: { borderColor: Colors.primary + '40', backgroundColor: Colors.primaryLight + '50' },
  notifIcon: { fontSize: 20 },
  notifTitle: { fontSize: 13, fontWeight: '600', color: Colors.text },
  notifBody: { fontSize: 12, color: Colors.textSecondary, marginTop: 2, lineHeight: 16 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginTop: 4 },
  emptyNotif: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', padding: 16 },
  actions: { padding: 16, gap: 8, marginBottom: 16 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  signOutBtn: { borderColor: Colors.alertLight },
  actionIcon: { fontSize: 20 },
  actionText: { fontSize: 14, fontWeight: '600', color: Colors.text, flex: 1 },
  langBtns: { flexDirection: 'row', gap: 6 },
  langBtn: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  langBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  langBtnText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  langBtnTextActive: { color: Colors.white },
})
