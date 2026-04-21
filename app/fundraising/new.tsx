import { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Colors } from '@/constants/colors'
import type { FundraiserBeneficiary } from '@/types'

const BENEFICIARY_TYPES: { value: FundraiserBeneficiary; label: string; icon: string; desc: string }[] = [
  { value: 'animal', label: 'Animal específico', icon: '🐾', desc: 'Para un animal que necesita ayuda' },
  { value: 'person', label: 'Persona', icon: '🙋', desc: 'Para alguien que rescata o cuida animales' },
  { value: 'emergency_fund', label: 'Fondo de emergencia', icon: '🏦', desc: 'Contribuir al pozo común' },
]

export default function NewFundraiser() {
  const { profile } = useAuthStore()
  const [beneficiaryType, setBeneficiaryType] = useState<FundraiserBeneficiary>('animal')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim() || !targetAmount) {
      Alert.alert('Campos requeridos', 'Completa todos los campos')
      return
    }
    const amount = parseFloat(targetAmount)
    if (!amount || amount <= 0) {
      Alert.alert('Monto inválido', 'Ingresa un monto de recaudación válido')
      return
    }
    if (!profile) return

    setLoading(true)
    const { error } = await supabase.from('fundraisers').insert({
      creator_id: profile.id,
      title: title.trim(),
      description: description.trim(),
      beneficiary_type: beneficiaryType,
      target_amount: amount,
      current_amount: 0,
      status: 'active',
      cover_photo: null,
    })
    setLoading(false)

    if (error) {
      Alert.alert('Error', error.message)
      return
    }

    Alert.alert('¡Campaña creada!', 'Tu campaña de recaudación ya está activa.', [
      { text: 'OK', onPress: () => router.replace('/(tabs)/fund') },
    ])
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Nueva Campaña</Text>
        <TouchableOpacity onPress={handleSubmit} disabled={loading}>
          {loading
            ? <ActivityIndicator color={Colors.primary} size="small" />
            : <Text style={styles.publishText}>Publicar</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.field}>
          <Text style={styles.label}>¿Para quién es la campaña?</Text>
          <View style={styles.typeList}>
            {BENEFICIARY_TYPES.map(({ value, label, icon, desc }) => (
              <TouchableOpacity
                key={value}
                style={[styles.typeCard, beneficiaryType === value && styles.typeCardActive]}
                onPress={() => setBeneficiaryType(value)}
              >
                <Text style={styles.typeIcon}>{icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.typeLabel, beneficiaryType === value && styles.typeLabelActive]}>
                    {label}
                  </Text>
                  <Text style={styles.typeDesc}>{desc}</Text>
                </View>
                {beneficiaryType === value && <Text style={styles.typeCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Título de la campaña *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Ej: Cirugía urgente para Toto"
            placeholderTextColor={Colors.textDisabled}
            maxLength={100}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Descripción *</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Explica la situación y para qué se usarán los fondos..."
            placeholderTextColor={Colors.textDisabled}
            multiline
            textAlignVertical="top"
            maxLength={1000}
          />
          <Text style={styles.charCount}>{description.length}/1000</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Meta de recaudación *</Text>
          <View style={styles.amountBox}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput
              style={styles.amountInput}
              value={targetAmount}
              onChangeText={setTargetAmount}
              placeholder="0"
              placeholderTextColor={Colors.textDisabled}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.note}>
          <Text style={styles.noteText}>
            💡 Las donaciones serán visibles para toda la comunidad. Los fondos recaudados quedarán
            registrados para transparencia.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

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
  publishText: { color: Colors.primary, fontSize: 15, fontWeight: '700' },
  inner: { padding: 20, gap: 24, paddingBottom: 40 },
  field: { gap: 10 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text },
  typeList: { gap: 10 },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: 10,
  },
  typeCardActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  typeIcon: { fontSize: 28 },
  typeLabel: { fontSize: 14, fontWeight: '600', color: Colors.text },
  typeLabelActive: { color: Colors.primaryDark },
  typeDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  typeCheck: { color: Colors.primary, fontSize: 18, fontWeight: '700' },
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
  textarea: { minHeight: 120, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: Colors.textDisabled, textAlign: 'right' },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 16,
  },
  currencySymbol: { fontSize: 20, color: Colors.primary, fontWeight: '700', marginRight: 8 },
  amountInput: { flex: 1, paddingVertical: 14, fontSize: 22, color: Colors.text, fontWeight: '700' },
  note: { backgroundColor: Colors.primaryLight, borderRadius: 12, padding: 14 },
  noteText: { fontSize: 13, color: Colors.primaryDark, lineHeight: 18 },
})
