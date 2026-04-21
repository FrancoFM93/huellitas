import { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, Switch,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Colors } from '@/constants/colors'

const VET_SPECIALTIES = [
  'Medicina General', 'Cirugía', 'Dermatología', 'Cardiología',
  'Oncología', 'Oftalmología', 'Odontología', 'Animales Exóticos',
]

const CLINIC_SERVICES = [
  'Consulta General', 'Cirugía', 'Hospitalización', 'Rayos X',
  'Ecografía', 'Laboratorio', 'Vacunación', 'Peluquería', 'Emergencias 24h',
]

export default function Onboarding() {
  const { profile, fetchProfile } = useAuthStore()
  const [loading, setLoading] = useState(false)

  // Vet fields
  const [license, setLicense] = useState('')
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([])
  const [consultationFee, setConsultationFee] = useState('')
  const [vetPhone, setVetPhone] = useState('')
  const [available, setAvailable] = useState(true)

  // Clinic fields
  const [clinicAddress, setClinicAddress] = useState('')
  const [clinicPhone, setClinicPhone] = useState('')
  const [clinicEmail, setClinicEmail] = useState('')
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [emergency24h, setEmergency24h] = useState(false)

  const toggleSpecialty = (s: string) =>
    setSelectedSpecialties((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    )

  const toggleService = (s: string) =>
    setSelectedServices((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    )

  const skip = () => router.replace('/(tabs)')

  const handleSave = async () => {
    if (!profile) return

    setLoading(true)

    if (profile.type === 'vet') {
      if (!license) {
        Alert.alert('Requerido', 'Ingresa tu número de matrícula')
        setLoading(false)
        return
      }
      const { error } = await supabase.from('vet_profiles').insert({
        profile_id: profile.id,
        license_number: license,
        specialties: selectedSpecialties,
        consultation_fee: consultationFee ? parseFloat(consultationFee) : null,
        phone: vetPhone || null,
        available,
        schedule: {},
      })
      if (error) {
        Alert.alert('Error', error.message)
        setLoading(false)
        return
      }
    }

    if (profile.type === 'clinic') {
      if (!clinicAddress || !clinicPhone) {
        Alert.alert('Requerido', 'Ingresa la dirección y teléfono de la clínica')
        setLoading(false)
        return
      }
      const { error } = await supabase.from('clinic_profiles').insert({
        profile_id: profile.id,
        address: clinicAddress,
        phone: clinicPhone,
        email: clinicEmail || null,
        services: selectedServices,
        emergency_24h: emergency24h,
        schedule: {},
      })
      if (error) {
        Alert.alert('Error', error.message)
        setLoading(false)
        return
      }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (user) await fetchProfile(user.id)

    setLoading(false)
    router.replace('/(tabs)')
  }

  if (!profile) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.inner}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Completa tu perfil</Text>
        <Text style={styles.subtitle}>
          {profile.type === 'user'
            ? 'Cuéntanos un poco más sobre ti'
            : profile.type === 'vet'
            ? 'Agrega tu información profesional'
            : 'Agrega los datos de tu clínica'}
        </Text>

        {profile.type === 'user' && (
          <View style={styles.userMsg}>
            <Text style={styles.userMsgText}>
              ¡Ya estás listo! Puedes agregar tus mascotas desde tu perfil en cualquier momento.
            </Text>
          </View>
        )}

        {profile.type === 'vet' && (
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Número de matrícula *</Text>
              <TextInput
                style={styles.input}
                value={license}
                onChangeText={setLicense}
                placeholder="Ej: MV-12345"
                placeholderTextColor={Colors.textDisabled}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Teléfono de contacto</Text>
              <TextInput
                style={styles.input}
                value={vetPhone}
                onChangeText={setVetPhone}
                placeholder="+54 9 11 0000-0000"
                placeholderTextColor={Colors.textDisabled}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Honorario por consulta (opcional)</Text>
              <TextInput
                style={styles.input}
                value={consultationFee}
                onChangeText={setConsultationFee}
                placeholder="Ej: 3500"
                placeholderTextColor={Colors.textDisabled}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Especialidades</Text>
              <View style={styles.chips}>
                {VET_SPECIALTIES.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, selectedSpecialties.includes(s) && styles.chipActive]}
                    onPress={() => toggleSpecialty(s)}
                  >
                    <Text style={[styles.chipText, selectedSpecialties.includes(s) && styles.chipTextActive]}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.label}>Disponible para atender ahora</Text>
              <Switch
                value={available}
                onValueChange={setAvailable}
                trackColor={{ true: Colors.primary }}
              />
            </View>
          </View>
        )}

        {profile.type === 'clinic' && (
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Dirección *</Text>
              <TextInput
                style={styles.input}
                value={clinicAddress}
                onChangeText={setClinicAddress}
                placeholder="Calle, número, ciudad"
                placeholderTextColor={Colors.textDisabled}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Teléfono *</Text>
              <TextInput
                style={styles.input}
                value={clinicPhone}
                onChangeText={setClinicPhone}
                placeholder="+54 9 11 0000-0000"
                placeholderTextColor={Colors.textDisabled}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Email (opcional)</Text>
              <TextInput
                style={styles.input}
                value={clinicEmail}
                onChangeText={setClinicEmail}
                placeholder="clinica@email.com"
                placeholderTextColor={Colors.textDisabled}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Servicios</Text>
              <View style={styles.chips}>
                {CLINIC_SERVICES.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, selectedServices.includes(s) && styles.chipActive]}
                    onPress={() => toggleService(s)}
                  >
                    <Text style={[styles.chipText, selectedServices.includes(s) && styles.chipTextActive]}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.label}>Atención de emergencias 24h</Text>
              <Switch
                value={emergency24h}
                onValueChange={setEmergency24h}
                trackColor={{ true: Colors.primary }}
              />
            </View>
          </View>
        )}

        <View style={styles.actions}>
          {profile.type !== 'user' && (
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={Colors.white} />
                : <Text style={styles.btnText}>Guardar y comenzar</Text>
              }
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={profile.type === 'user' ? styles.btn : styles.skipBtn}
            onPress={profile.type === 'user' ? skip : skip}
          >
            <Text style={profile.type === 'user' ? styles.btnText : styles.skipText}>
              {profile.type === 'user' ? '¡Comenzar!' : 'Completar más tarde'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  inner: { paddingHorizontal: 24, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text, marginTop: 16 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 4, marginBottom: 24 },
  userMsg: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },
  userMsgText: { color: Colors.primaryDark, fontSize: 14, lineHeight: 20 },
  form: { gap: 20 },
  field: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.text,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  chipTextActive: { color: Colors.primaryDark },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  actions: { gap: 12, marginTop: 32 },
  btn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  skipBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  skipText: { color: Colors.textMuted, fontSize: 14 },
})
