import { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Colors } from '@/constants/colors'
import type { ProfileType } from '@/types'

const PROFILE_TYPES: { type: ProfileType; label: string; icon: string; desc: string }[] = [
  { type: 'user', label: 'Dueño / Adoptante', icon: '🏠', desc: 'Registro mascotas y participo en la comunidad' },
  { type: 'vet', label: 'Veterinario', icon: '🩺', desc: 'Ofrezco atención veterinaria' },
  { type: 'clinic', label: 'Clínica Veterinaria', icon: '🏥', desc: 'Represento una clínica o consultorio' },
  { type: 'fundacion', label: 'Fundación / ONG', icon: '🏛️', desc: 'Soy una organización que ayuda a animales' },
]

export default function Register() {
  const { fetchProfile, setSession } = useAuthStore()
  const [step, setStep] = useState<1 | 2>(1)
  const [profileType, setProfileType] = useState<ProfileType>('user')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert('Campos requeridos', 'Completa todos los campos')
      return
    }
    if (password.length < 6) {
      Alert.alert('Contraseña muy corta', 'La contraseña debe tener al menos 6 caracteres')
      return
    }

    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, type: profileType },
      },
    })
    if (error) {
      setLoading(false)
      Alert.alert('Error', error.message)
      return
    }

    if (data.session) {
      // Email confirmation is off — session ready immediately
      setSession(data.session)
      await fetchProfile(data.session.user.id)
      setLoading(false)
      router.replace('/(auth)/onboarding')
    } else {
      // Email confirmation is on — tell user to check their inbox
      setLoading(false)
      setEmailSent(true)
    }
  }

  if (emailSent) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emailSent}>
          <Text style={styles.emailIcon}>📬</Text>
          <Text style={styles.emailTitle}>Revisa tu correo</Text>
          <Text style={styles.emailBody}>
            Te enviamos un enlace de confirmación a{'\n'}
            <Text style={{ fontWeight: '700' }}>{email}</Text>
          </Text>
          <Text style={styles.emailHint}>
            Una vez que confirmes tu correo, abre la app de nuevo para iniciar sesión.
          </Text>
          <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.btnText}>Ir al inicio de sesión</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.inner}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity style={styles.back} onPress={() => step === 1 ? router.back() : setStep(1)}>
            <Text style={styles.backText}>← Volver</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Crear cuenta</Text>
          <Text style={styles.subtitle}>Paso {step} de 2</Text>

          <View style={styles.steps}>
            <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]} />
            <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
            <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]} />
          </View>

          {step === 1 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>¿Cómo vas a usar Huellitas?</Text>
              <View style={styles.typeList}>
                {PROFILE_TYPES.map(({ type, label, icon, desc }) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeCard, profileType === type && styles.typeCardActive]}
                    onPress={() => setProfileType(type)}
                  >
                    <Text style={styles.typeIcon}>{icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.typeLabel, profileType === type && styles.typeLabelActive]}>
                        {label}
                      </Text>
                      <Text style={styles.typeDesc}>{desc}</Text>
                    </View>
                    {profileType === type && <Text style={styles.typeCheck}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.btn} onPress={() => setStep(2)}>
                <Text style={styles.btnText}>Continuar</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 2 && (
            <View style={styles.form}>
              <View style={styles.field}>
                <Text style={styles.label}>
                  {profileType === 'clinic' ? 'Nombre de la clínica' : 'Nombre completo'}
                </Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder={profileType === 'clinic' ? 'Clínica Veterinaria...' : 'Tu nombre'}
                  placeholderTextColor={Colors.textDisabled}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="tu@email.com"
                  placeholderTextColor={Colors.textDisabled}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Contraseña</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor={Colors.textDisabled}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={handleRegister}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={styles.btnText}>Crear cuenta</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>¿Ya tienes cuenta? </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
              <Text style={styles.footerLink}>Ingresar</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  inner: { paddingHorizontal: 24, paddingBottom: 40 },
  back: { paddingVertical: 12 },
  backText: { color: Colors.primary, fontSize: 15, fontWeight: '500' },
  title: { fontSize: 28, fontWeight: '800', color: Colors.text, marginTop: 8 },
  subtitle: { fontSize: 14, color: Colors.textMuted, marginTop: 4 },
  steps: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.border },
  stepDotActive: { backgroundColor: Colors.primary },
  stepLine: { flex: 1, height: 2, backgroundColor: Colors.border, marginHorizontal: 6 },
  stepLineActive: { backgroundColor: Colors.primary },
  section: { gap: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: Colors.text },
  typeList: { gap: 10 },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: 12,
  },
  typeCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  typeIcon: { fontSize: 28 },
  typeLabel: { fontSize: 15, fontWeight: '600', color: Colors.text },
  typeLabelActive: { color: Colors.primaryDark },
  typeDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  typeCheck: { color: Colors.primary, fontSize: 18, fontWeight: '700' },
  form: { gap: 16 },
  field: { gap: 6 },
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
  btn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 28 },
  footerText: { color: Colors.textSecondary, fontSize: 14 },
  footerLink: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  emailSent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, gap: 16 },
  emailIcon: { fontSize: 64 },
  emailTitle: { fontSize: 24, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  emailBody: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  emailHint: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
})
