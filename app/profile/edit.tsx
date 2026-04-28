import { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, Switch, Image,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuthStore } from '@/store/authStore'
import { usePhotoUpload } from '@/lib/usePhotoUpload'
import { supabase } from '@/lib/supabase'
import { Colors } from '@/constants/colors'

export default function EditProfile() {
  const { profile, vetProfile, clinicProfile, session, fetchProfile } = useAuthStore()
  const { upload, uploading } = usePhotoUpload()

  // Common profile fields
  const [name, setName] = useState(profile?.name ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '')

  // Vet-specific fields
  const [available, setAvailable] = useState(vetProfile?.available ?? true)
  const [fee, setFee] = useState(vetProfile?.consultation_fee?.toString() ?? '')
  const [specialties, setSpecialties] = useState(vetProfile?.specialties?.join(', ') ?? '')
  const [vetPhone, setVetPhone] = useState(vetProfile?.phone ?? '')
  const [vetEmail, setVetEmail] = useState(vetProfile?.email ?? '')
  const [vetWebsite, setVetWebsite] = useState(vetProfile?.website ?? '')

  // Clinic-specific fields
  const [address, setAddress] = useState(clinicProfile?.address ?? '')
  const [clinicPhone, setClinicPhone] = useState(clinicProfile?.phone ?? '')
  const [clinicEmail, setClinicEmail] = useState(clinicProfile?.email ?? '')
  const [clinicWebsite, setClinicWebsite] = useState(clinicProfile?.website ?? '')
  const [services, setServices] = useState(clinicProfile?.services?.join(', ') ?? '')
  const [emergency24h, setEmergency24h] = useState(clinicProfile?.emergency_24h ?? false)

  const [saving, setSaving] = useState(false)

  const handlePickAvatar = async () => {
    const url = await upload({ folder: 'avatars', quality: 0.8 })
    if (url) setAvatarUrl(url)
  }

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Campo requerido', 'El nombre no puede estar vacío')
      return
    }
    if (!profile || !session?.user) return

    setSaving(true)
    try {
      // Update base profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: name.trim(),
          bio: bio.trim() || null,
          phone: phone.trim() || null,
          avatar_url: avatarUrl || null,
        })
        .eq('id', profile.id)

      if (profileError) throw profileError

      // Update vet sub-profile if applicable
      if (profile.type === 'vet' && vetProfile) {
        const { error } = await supabase
          .from('vet_profiles')
          .update({
            available,
            consultation_fee: fee ? parseFloat(fee) : null,
            // Split comma-separated string into array, trim whitespace
            specialties: specialties.split(',').map((s) => s.trim()).filter(Boolean),
            phone: vetPhone.trim() || null,
            email: vetEmail.trim() || null,
            website: vetWebsite.trim() || null,
          })
          .eq('profile_id', profile.id)

        if (error) throw error
      }

      // Update clinic sub-profile if applicable
      if (profile.type === 'clinic' && clinicProfile) {
        if (!address.trim() || !clinicPhone.trim()) {
          Alert.alert('Campos requeridos', 'Dirección y teléfono son obligatorios')
          setSaving(false)
          return
        }
        const { error } = await supabase
          .from('clinic_profiles')
          .update({
            address: address.trim(),
            phone: clinicPhone.trim(),
            email: clinicEmail.trim() || null,
            website: clinicWebsite.trim() || null,
            services: services.split(',').map((s) => s.trim()).filter(Boolean),
            emergency_24h: emergency24h,
          })
          .eq('profile_id', profile.id)

        if (error) throw error
      }

      // Refresh global auth state so the profile screen reflects changes immediately
      await fetchProfile(session.user.id)

      Alert.alert('¡Listo!', 'Tu perfil fue actualizado.', [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  if (!profile) return null

  const typeIcon = profile.type === 'vet' ? '🩺' : profile.type === 'clinic' ? '🏥' : '👤'

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Editar Perfil</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving || uploading}>
          {saving
            ? <ActivityIndicator color={Colors.primary} size="small" />
            : <Text style={styles.saveText}>Guardar</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar */}
        <TouchableOpacity style={styles.avatarSection} onPress={handlePickAvatar} disabled={uploading}>
          {avatarUrl
            ? <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarIcon}>{typeIcon}</Text>
              </View>
            )
          }
          <View style={styles.avatarEditBadge}>
            {uploading
              ? <ActivityIndicator size="small" color={Colors.white} />
              : <Text style={styles.avatarEditText}>📷</Text>
            }
          </View>
        </TouchableOpacity>

        {/* Common fields */}
        <Section title="Información general">
          <Field label="Nombre *">
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Tu nombre"
              placeholderTextColor={Colors.textDisabled}
              autoCapitalize="words"
            />
          </Field>
          <Field label="Teléfono">
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+54 11 1234-5678"
              placeholderTextColor={Colors.textDisabled}
              keyboardType="phone-pad"
            />
          </Field>
          <Field label="Bio">
            <TextInput
              style={[styles.input, styles.textarea]}
              value={bio}
              onChangeText={setBio}
              placeholder="Cuéntanos algo sobre ti..."
              placeholderTextColor={Colors.textDisabled}
              multiline
              textAlignVertical="top"
              maxLength={300}
            />
          </Field>
        </Section>

        {/* Vet-specific section */}
        {profile.type === 'vet' && (
          <Section title="Información profesional">
            <ToggleRow
              label="Disponible para consultas"
              value={available}
              onValueChange={setAvailable}
            />
            <Field label="Honorarios por consulta ($)">
              <TextInput
                style={styles.input}
                value={fee}
                onChangeText={setFee}
                placeholder="Ej: 5000"
                placeholderTextColor={Colors.textDisabled}
                keyboardType="decimal-pad"
              />
            </Field>
            <Field label="Especialidades (separadas por coma)">
              <TextInput
                style={styles.input}
                value={specialties}
                onChangeText={setSpecialties}
                placeholder="Ej: Clínica general, Cirugía"
                placeholderTextColor={Colors.textDisabled}
                autoCapitalize="sentences"
              />
            </Field>
            <Field label="Teléfono de consultorio">
              <TextInput
                style={styles.input}
                value={vetPhone}
                onChangeText={setVetPhone}
                placeholder="+54 11 1234-5678"
                placeholderTextColor={Colors.textDisabled}
                keyboardType="phone-pad"
              />
            </Field>
            <Field label="Email">
              <TextInput
                style={styles.input}
                value={vetEmail}
                onChangeText={setVetEmail}
                placeholder="contacto@veterinaria.com"
                placeholderTextColor={Colors.textDisabled}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </Field>
            <Field label="Sitio web">
              <TextInput
                style={styles.input}
                value={vetWebsite}
                onChangeText={setVetWebsite}
                placeholder="https://..."
                placeholderTextColor={Colors.textDisabled}
                autoCapitalize="none"
                keyboardType="url"
              />
            </Field>
          </Section>
        )}

        {/* Clinic-specific section */}
        {profile.type === 'clinic' && (
          <Section title="Datos de la clínica">
            <Field label="Dirección *">
              <TextInput
                style={styles.input}
                value={address}
                onChangeText={setAddress}
                placeholder="Calle y número, ciudad"
                placeholderTextColor={Colors.textDisabled}
                autoCapitalize="words"
              />
            </Field>
            <Field label="Teléfono *">
              <TextInput
                style={styles.input}
                value={clinicPhone}
                onChangeText={setClinicPhone}
                placeholder="+54 11 1234-5678"
                placeholderTextColor={Colors.textDisabled}
                keyboardType="phone-pad"
              />
            </Field>
            <Field label="Email">
              <TextInput
                style={styles.input}
                value={clinicEmail}
                onChangeText={setClinicEmail}
                placeholder="info@clinica.com"
                placeholderTextColor={Colors.textDisabled}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </Field>
            <Field label="Sitio web">
              <TextInput
                style={styles.input}
                value={clinicWebsite}
                onChangeText={setClinicWebsite}
                placeholder="https://..."
                placeholderTextColor={Colors.textDisabled}
                autoCapitalize="none"
                keyboardType="url"
              />
            </Field>
            <Field label="Servicios (separados por coma)">
              <TextInput
                style={styles.input}
                value={services}
                onChangeText={setServices}
                placeholder="Ej: Vacunación, Cirugía, Urgencias"
                placeholderTextColor={Colors.textDisabled}
                autoCapitalize="sentences"
              />
            </Field>
            <ToggleRow
              label="Atención de emergencias 24hs"
              value={emergency24h}
              onValueChange={setEmergency24h}
            />
          </Section>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Small layout helpers ─────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  )
}

function ToggleRow({
  label, value, onValueChange,
}: {
  label: string; value: boolean; onValueChange: (v: boolean) => void
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: Colors.primary }}
        thumbColor={Colors.white}
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
  cancelText: { color: Colors.textSecondary, fontSize: 15 },
  topBarTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  saveText: { color: Colors.primary, fontSize: 15, fontWeight: '700' },
  inner: { padding: 20, gap: 20, paddingBottom: 48 },

  avatarSection: {
    alignSelf: 'center',
    position: 'relative',
    marginBottom: 4,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primaryLight,
    borderWidth: 3,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarIcon: { fontSize: 44 },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  avatarEditText: { fontSize: 14 },

  section: { gap: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase' },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 16,
  },

  field: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.text },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },

  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleLabel: { fontSize: 14, color: Colors.text, flex: 1 },
})
