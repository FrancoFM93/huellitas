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
import type { PetSpecies } from '@/types'

const SPECIES: { value: PetSpecies; label: string; icon: string }[] = [
  { value: 'dog', label: 'Perro', icon: '🐶' },
  { value: 'cat', label: 'Gato', icon: '🐱' },
  { value: 'bird', label: 'Ave', icon: '🐦' },
  { value: 'rabbit', label: 'Conejo', icon: '🐰' },
  { value: 'other', label: 'Otro', icon: '🐾' },
]

export default function NewPet() {
  const { profile } = useAuthStore()
  const [name, setName] = useState('')
  const [species, setSpecies] = useState<PetSpecies>('dog')
  const [breed, setBreed] = useState('')
  const [color, setColor] = useState('')
  const [ageYears, setAgeYears] = useState('')
  const [ageMonths, setAgeMonths] = useState('')
  const [weight, setWeight] = useState('')
  const [microchip, setMicrochip] = useState('')
  const [medicalNotes, setMedicalNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    if (!name.trim() || !color.trim()) {
      Alert.alert('Campos requeridos', 'Ingresa el nombre y color de tu mascota')
      return
    }
    if (!profile) return

    setLoading(true)
    const { error } = await supabase.from('pets').insert({
      owner_id: profile.id,
      name: name.trim(),
      species,
      breed: breed.trim() || null,
      color: color.trim(),
      age_years: ageYears ? parseInt(ageYears) : null,
      age_months: ageMonths ? parseInt(ageMonths) : null,
      weight_kg: weight ? parseFloat(weight) : null,
      microchip: microchip.trim() || null,
      medical_notes: medicalNotes.trim() || null,
      photos: [],
      is_missing: false,
    })
    setLoading(false)

    if (error) {
      Alert.alert('Error', error.message)
      return
    }

    Alert.alert('¡Mascota registrada!', `${name} ya está en tu perfil.`, [
      { text: 'OK', onPress: () => router.back() },
    ])
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Nueva Mascota</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading}>
          {loading
            ? <ActivityIndicator color={Colors.primary} size="small" />
            : <Text style={styles.saveText}>Guardar</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        {/* Species */}
        <View style={styles.field}>
          <Text style={styles.label}>Especie</Text>
          <View style={styles.speciesRow}>
            {SPECIES.map(({ value, label, icon }) => (
              <TouchableOpacity
                key={value}
                style={[styles.speciesBtn, species === value && styles.speciesBtnActive]}
                onPress={() => setSpecies(value)}
              >
                <Text style={styles.speciesIcon}>{icon}</Text>
                <Text style={[styles.speciesLabel, species === value && styles.speciesLabelActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Nombre *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Ej: Firulais"
            placeholderTextColor={Colors.textDisabled}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Raza</Text>
          <TextInput
            style={styles.input}
            value={breed}
            onChangeText={setBreed}
            placeholder="Ej: Labrador, Mestizo..."
            placeholderTextColor={Colors.textDisabled}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Color / Descripción física *</Text>
          <TextInput
            style={styles.input}
            value={color}
            onChangeText={setColor}
            placeholder="Ej: Negro con manchas blancas"
            placeholderTextColor={Colors.textDisabled}
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Edad (años)</Text>
            <TextInput
              style={styles.input}
              value={ageYears}
              onChangeText={setAgeYears}
              placeholder="0"
              placeholderTextColor={Colors.textDisabled}
              keyboardType="number-pad"
            />
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Meses</Text>
            <TextInput
              style={styles.input}
              value={ageMonths}
              onChangeText={setAgeMonths}
              placeholder="0"
              placeholderTextColor={Colors.textDisabled}
              keyboardType="number-pad"
            />
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Peso (kg)</Text>
            <TextInput
              style={styles.input}
              value={weight}
              onChangeText={setWeight}
              placeholder="0.0"
              placeholderTextColor={Colors.textDisabled}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Número de microchip</Text>
          <TextInput
            style={styles.input}
            value={microchip}
            onChangeText={setMicrochip}
            placeholder="Opcional"
            placeholderTextColor={Colors.textDisabled}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Notas médicas</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={medicalNotes}
            onChangeText={setMedicalNotes}
            placeholder="Vacunas, alergias, medicación, etc..."
            placeholderTextColor={Colors.textDisabled}
            multiline
            textAlignVertical="top"
          />
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
  saveText: { color: Colors.primary, fontSize: 15, fontWeight: '700' },
  inner: { padding: 20, gap: 20, paddingBottom: 40 },
  field: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text },
  speciesRow: { flexDirection: 'row', gap: 8 },
  speciesBtn: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: 4,
  },
  speciesBtnActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  speciesIcon: { fontSize: 22 },
  speciesLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' },
  speciesLabelActive: { color: Colors.primaryDark },
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
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 10 },
})
