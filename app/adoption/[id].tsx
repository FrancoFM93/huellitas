import { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Linking, Image, Dimensions,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const CAROUSEL_HEIGHT = 280
import { useLocalSearchParams, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Colors } from '@/constants/colors'
import type { AdoptionPost } from '@/types'

const SPECIES_ICONS: Record<string, string> = {
  dog: '🐶', cat: '🐱', bird: '🐦', rabbit: '🐰', other: '🐾',
}

const AGE_LABELS: Record<string, string> = {
  puppy: 'Cachorro (0–1 año)',
  young: 'Joven (1–3 años)',
  adult: 'Adulto (3–8 años)',
  senior: 'Mayor (8+ años)',
}

const SEX_LABELS: Record<string, { icon: string; label: string }> = {
  male: { icon: '♂', label: 'Macho' },
  female: { icon: '♀', label: 'Hembra' },
  unknown: { icon: '?', label: 'Sexo no especificado' },
}

const HEALTH_LABELS: Record<string, { icon: string; label: string; color: string }> = {
  healthy: { icon: '💚', label: 'Saludable', color: Colors.success },
  treatment: { icon: '🩹', label: 'En tratamiento', color: Colors.warning },
  chronic: { icon: '💊', label: 'Condición crónica', color: Colors.info },
  special_needs: { icon: '🫶', label: 'Necesidades especiales', color: Colors.primary },
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

export default function AdoptionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { profile } = useAuthStore()
  const qc = useQueryClient()

  const { data: post, isLoading } = useQuery({
    queryKey: ['adoption', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('adoption_posts')
        .select('*, poster:profiles(id,name,avatar_url,type,phone,verified)')
        .eq('id', id)
        .single()
      return data as AdoptionPost
    },
  })

  const markAdoptedMutation = useMutation({
    mutationFn: async (newStatus: 'reserved' | 'adopted') => {
      const { error } = await supabase
        .from('adoption_posts')
        .update({ status: newStatus })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adoption', id] })
      qc.invalidateQueries({ queryKey: ['adoptions'] })
    },
    onError: (e: Error) => Alert.alert('Error', e.message),
  })

  const isPosterOwner = !!post && !!profile && profile.id === post.poster_id

  const { data: apps } = useQuery({
    queryKey: ['apps', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('adoption_applications')
        .select('*, applicant:profiles(id,name,avatar_url,phone)')
        .eq('post_id', id)
        .order('created_at', { ascending: false })
      return data ?? []
    },
    enabled: isPosterOwner,
  })

  const approveMutation = useMutation({
    mutationFn: async (appId: string) => {
      const { error } = await supabase.rpc('fn_approve_application', { app_id: appId })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['apps', id] })
      qc.invalidateQueries({ queryKey: ['adoption', id] })
      qc.invalidateQueries({ queryKey: ['adoptions'] })
      Alert.alert('¡Aprobado!', 'Contrato creado con sesiones de seguimiento.')
    },
    onError: (e: Error) => Alert.alert('Error', e.message),
  })

  if (isLoading || !post) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    )
  }

  const isOwner = profile?.id === post.poster_id
  const posterProfile = post.poster as any

  const STATUS_COLORS = {
    available: Colors.success,
    reserved: Colors.warning,
    adopted: Colors.textMuted,
  }
  const STATUS_LABELS = {
    available: '✅ Disponible',
    reserved: '⏳ Reservado',
    adopted: '🏠 Ya adoptado',
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        {isOwner && (
          <TouchableOpacity
            onPress={() => {
              const options: any[] = [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Editar publicación', onPress: () => router.push(`/adoption/edit/${post.id}`) },
              ]
              if (post.status === 'available') {
                options.push(
                  { text: 'Marcar como reservado', onPress: () => markAdoptedMutation.mutate('reserved') },
                  { text: '¡Ya fue adoptado! 🎉', onPress: () => markAdoptedMutation.mutate('adopted') },
                )
              }
              Alert.alert('Publicación', 'Elegí qué hacer', options)
            }}
          >
            <Text style={styles.editText}>Actualizar</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        {post.photos && post.photos.length > 0 ? (
          <PhotoCarousel photos={post.photos} />
        ) : null}

        <View style={styles.hero}>
          {(!post.photos || post.photos.length === 0) && (
            <View style={styles.heroIconContainer}>
              <Text style={styles.heroIcon}>{SPECIES_ICONS[post.species]}</Text>
            </View>
          )}

          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[post.status] + '20' }]}>
            <Text style={[styles.statusText, { color: STATUS_COLORS[post.status] }]}>
              {STATUS_LABELS[post.status]}
            </Text>
          </View>

          <Text style={styles.name}>{post.name}</Text>
          <Text style={styles.breed}>
            {post.species}{post.breed ? ` · ${post.breed}` : ''}
          </Text>
          <Text style={styles.age}>{AGE_LABELS[post.age_range] ?? post.age_range}</Text>
        </View>

        {/* Sex + health status */}
        <View style={styles.chipsRow}>
          {post.sex && post.sex !== 'unknown' && (
            <Chip
              icon={SEX_LABELS[post.sex].icon}
              label={SEX_LABELS[post.sex].label}
              color={post.sex === 'female' ? '#D94F8A' : Colors.info}
            />
          )}
          {post.health_status && (
            <Chip
              icon={HEALTH_LABELS[post.health_status].icon}
              label={HEALTH_LABELS[post.health_status].label}
              color={HEALTH_LABELS[post.health_status].color}
            />
          )}
        </View>

        {/* Health chips */}
        <View style={styles.chipsRow}>
          {post.is_vaccinated && <Chip icon="💉" label="Vacunado/a" color={Colors.success} />}
          {post.is_neutered && <Chip icon="✂️" label="Castrado/a" color={Colors.info} />}
          {post.is_dewormed && <Chip icon="💊" label="Desparasitado/a" color={Colors.warning} />}
          {post.good_with_kids && <Chip icon="👶" label="Con niños" color={Colors.primary} />}
          {post.good_with_pets && <Chip icon="🐾" label="Con mascotas" color={Colors.primary} />}
        </View>

        {/* Color */}
        {post.color && (
          <InfoRow icon="🎨" label="Color" value={post.color} />
        )}

        {/* Location */}
        <InfoRow icon="📍" label="Zona" value={post.location} />

        {/* Description */}
        <View style={styles.descCard}>
          <Text style={styles.descTitle}>Sobre {post.name}</Text>
          <Text style={styles.desc}>{post.description}</Text>
        </View>

        {/* Posted by */}
        <View style={styles.posterCard}>
          <Text style={styles.posterLabel}>Publicado por</Text>
          <View style={styles.posterRow}>
            <View style={styles.posterAvatar}>
              <Text style={styles.posterAvatarIcon}>
                {posterProfile?.type === 'vet' ? '🩺' :
                  posterProfile?.type === 'clinic' ? '🏥' : '👤'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.posterNameRow}>
                <Text style={styles.posterName}>{posterProfile?.name ?? 'Anónimo'}</Text>
                {posterProfile?.type === 'fundacion' && (
                  <View style={[styles.orgBadge, posterProfile?.verified && styles.orgBadgeVerified]}>
                    <Text style={styles.orgBadgeText}>
                      {posterProfile?.verified ? '🏛️ Fundación verificada' : '🏛️ Fundación'}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.posterTime}>{timeAgo(post.created_at)}</Text>
            </View>
          </View>
        </View>

        {/* Apply button */}
        {!isOwner && post.status === 'available' && profile && (
          <TouchableOpacity
            style={styles.applyBtn}
            onPress={() => router.push(`/adoption/apply/${post.id}`)}
          >
            <Text style={styles.applyBtnText}>📝 Solicitar adopción</Text>
          </TouchableOpacity>
        )}

        {/* Applications list (poster only) */}
        {isOwner && (apps ?? []).length > 0 && (
          <View style={styles.appsCard}>
            <Text style={styles.appsTitle}>Solicitudes ({apps!.length})</Text>
            {apps!.map((a: any) => (
              <View key={a.id} style={styles.appRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.appName}>{a.applicant?.name ?? 'Anónimo'}</Text>
                  <Text style={styles.appMessage} numberOfLines={3}>{a.message}</Text>
                  {a.contact_phone && (
                    <Text style={styles.appPhone}>📞 {a.contact_phone}</Text>
                  )}
                  <Text style={[styles.appStatus, a.status === 'approved' && styles.appStatusApproved, a.status === 'rejected' && styles.appStatusRejected]}>
                    {a.status === 'pending' ? '⏳ Pendiente' :
                      a.status === 'approved' ? '✅ Aprobada' :
                      a.status === 'rejected' ? '❌ Rechazada' : '🚫 Retirada'}
                  </Text>
                </View>
                {a.status === 'pending' && post.status === 'available' && (
                  <TouchableOpacity
                    style={styles.approveBtn}
                    onPress={() =>
                      Alert.alert(
                        'Aprobar solicitud',
                        `Al aprobar a ${a.applicant?.name ?? 'este adoptante'}, se creará un contrato de seguimiento y la publicación se marcará como adoptada.`,
                        [
                          { text: 'Cancelar', style: 'cancel' },
                          { text: 'Aprobar', onPress: () => approveMutation.mutate(a.id) },
                        ]
                      )
                    }
                  >
                    <Text style={styles.approveBtnText}>Aprobar</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Contact */}
        {post.status !== 'adopted' && (
          <View style={styles.contactCard}>
            <Text style={styles.contactTitle}>¿Te interesa adoptarlo/a?</Text>
            <Text style={styles.contactInfo}>{post.contact_info}</Text>

            {post.contact_info.includes('@') && (
              <TouchableOpacity
                style={styles.contactBtn}
                onPress={() => Linking.openURL(`mailto:${post.contact_info.match(/[\w.]+@[\w.]+/)?.[0]}`)}
              >
                <Text style={styles.contactBtnText}>✉️ Enviar email</Text>
              </TouchableOpacity>
            )}

            {(post.contact_info.match(/\+?\d[\d\s\-().]{8,}/) != null) && (
              <TouchableOpacity
                style={styles.contactBtnWhatsapp}
                onPress={() => {
                  const num = post.contact_info.replace(/\D/g, '')
                  Linking.openURL(`https://wa.me/${num}`)
                }}
              >
                <Text style={styles.contactBtnText}>💬 WhatsApp</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {post.status === 'adopted' && (
          <View style={styles.adoptedBanner}>
            <Text style={styles.adoptedBannerText}>🏠 ¡{post.name} ya encontró su hogar!</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function Chip({ icon, label, color }: { icon: string; label: string; color: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: color + '18', borderColor: color + '40' }]}>
      <Text style={styles.chipIcon}>{icon}</Text>
      <Text style={[styles.chipLabel, { color }]}>{label}</Text>
    </View>
  )
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <Text style={styles.infoLabel}>{label}: </Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  )
}

function PhotoCarousel({ photos }: { photos: string[] }) {
  const [index, setIndex] = useState(0)
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH)
    if (i !== index) setIndex(i)
  }
  return (
    <View style={styles.carousel}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={32}
      >
        {photos.map((url) => (
          <Image key={url} source={{ uri: url }} style={styles.carouselImg} />
        ))}
      </ScrollView>
      {photos.length > 1 && (
        <View style={styles.carouselDots}>
          {photos.map((_, i) => (
            <View key={i} style={[styles.carouselDot, i === index && styles.carouselDotActive]} />
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  carousel: {
    width: SCREEN_WIDTH, height: CAROUSEL_HEIGHT,
    backgroundColor: Colors.borderLight,
    marginHorizontal: -20, marginTop: -20, marginBottom: 8,
  },
  carouselImg: { width: SCREEN_WIDTH, height: CAROUSEL_HEIGHT },
  carouselDots: {
    position: 'absolute', bottom: 12, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  carouselDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  carouselDotActive: { backgroundColor: Colors.white, width: 18 },
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
  editText: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  inner: { padding: 20, gap: 16, paddingBottom: 48 },
  hero: { alignItems: 'center', gap: 8 },
  heroIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroIcon: { fontSize: 72 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5 },
  statusText: { fontSize: 13, fontWeight: '700' },
  name: { fontSize: 28, fontWeight: '800', color: Colors.text },
  breed: { fontSize: 15, color: Colors.primary, fontWeight: '500' },
  age: { fontSize: 13, color: Colors.textMuted },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    gap: 4,
  },
  chipIcon: { fontSize: 14 },
  chipLabel: { fontSize: 12, fontWeight: '600' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoIcon: { fontSize: 16 },
  infoLabel: { fontSize: 14, color: Colors.textMuted },
  infoValue: { fontSize: 14, color: Colors.text, fontWeight: '500', flex: 1 },
  descCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  descTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  desc: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },
  posterCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  posterLabel: { fontSize: 12, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  posterRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  posterAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  posterAvatarIcon: { fontSize: 20 },
  posterNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  posterName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  posterTime: { fontSize: 12, color: Colors.textMuted },
  orgBadge: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  orgBadgeVerified: { backgroundColor: Colors.successLight, borderColor: Colors.success },
  orgBadgeText: { fontSize: 11, color: Colors.primaryDark, fontWeight: '700' },
  applyBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  applyBtnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  appsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  appsTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  appName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  appMessage: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, lineHeight: 18 },
  appPhone: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  appStatus: { fontSize: 11, color: Colors.textMuted, marginTop: 6, fontWeight: '600' },
  appStatusApproved: { color: Colors.success },
  appStatusRejected: { color: Colors.alert },
  approveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  approveBtnText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  contactCard: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  contactTitle: { fontSize: 16, fontWeight: '700', color: Colors.primaryDark },
  contactInfo: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  contactBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  contactBtnWhatsapp: {
    backgroundColor: '#25D366',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  contactBtnText: { color: Colors.white, fontSize: 14, fontWeight: '700' },
  adoptedBanner: {
    backgroundColor: Colors.successLight,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  adoptedBannerText: { color: Colors.success, fontSize: 16, fontWeight: '700' },
})
