import { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, Image,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { usePhotoUpload } from '@/lib/usePhotoUpload'
import { Colors } from '@/constants/colors'
import type { Pet, PetSpecies } from '@/types'

const SPECIES: { value: PetSpecies; label: string; icon: string }[] = [
  { value: 'dog', label: 'Perro', icon: '🐶' },
  { value: 'cat', label: 'Gato', icon: '🐱' },
  { value: 'bird', label: 'Ave', icon: '🐦' },
  { value: 'rabbit', label: 'Conejo', icon: '🐰' },
  { value: 'other', label: 'Otro', icon: '🐾' },
]

export default function EditPet() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const qc = useQueryClient()
  const { upload, uploading } = usePhotoUpload()

  // Load existing pet data to pre-fill the form
  const { data: pet, isLoading } = useQuery({
    queryKey: ['pet', id],
    queryFn: async () => {
      const { data } = await supabase.from('pets').select('*').eq('id', id).single()
      return data as Pet
    },
  })

  // Form state — initialised once pet data arrives
  const [species, setSpecies] = useState<PetSpecies | null>(null)
  const [name, setName] = useState('')
  const [breed, setBreed] = useState('')
  const [color, setColor] = useState('')
  const [ageYears, setAgeYears] = useState('')
  const [ageMonths, setAgeMonths] = useState('')
  const [weight, setWeight] = useState('')
  const [microchip, setMicrochip] = useState('')
  const [medicalNotes, setMedicalNotes] = useState('')
  const [photos, setPhotos] = useState<string[] | null>(null)
  const [saving, setSaving] = useState(false)

  // Pre-fill state the first time pet data loads
  if (pet && name === null) {
    setSpecies(pet.species)
    setName(pet.name)
    setBreed(pet.breed ?? '')
    setColor(pet.color ?? '')
    setAgeYears(pet.age_years?.toString() ?? '')
    setAgeMonths(pet.age_months?.toString() ?? '')
    setWeight(pet.weight_kg?.toString() ?? '')
    setMicrochip(pet.microchip ?? '')
    setMedicalNotes(pet.medical_notes ?? '')
    setPhotos(pet.photos ?? [])
  }

  const handleAddPhoto = async () => {
    const url = await upload({ folder: 'pets', quality: 0.8 })
    if (url) setPhotos((prev) => [...(prev ?? []), url])
  }

  const handleRemovePhoto = (url: string) => {
    setPhotos((prev) => (prev ?? []).filter((p) => p !== url))
  }

  const handleSave = async () => {
    if (!name?.trim() || !color?.trim()) {
      Alert.alert('Campos requeridos', 'El nombre y color son obligatorios')
      return
    }

    setSaving(true)
    const { error } = await supabase
      .from('pets')
      .update({
        species: species!,
        name: name.trim(),
        breed: breed?.trim() || null,
        color: color.trim(),
        age_years: ageYears ? parseInt(ageYears) : null,
        age_months: ageMonths ? parseInt(ageMonths) : null,
        weight_kg: weight ? parseFloat(weight) : null,
        microchip: microchip?.trim() || null,
        medical_notes: medicalNotes?.trim() || null,
        photos: photos ?? [],
      })
      .eq('id', id)
    setSaving(false)

    if (error) {
      Alert.alert('Error', error.message)
      return
    }

    // Invalidate so pet detail and profile screens refresh
    qc.invalidateQueries({ queryKey: ['pet', id] })
    qc.invalidateQueries({ queryKey: ['my-pets'] })

    Alert.alert('¡Listo!', `${name} fue actualizado/a.`, [
      { text: 'OK', onPress: () => router.back() },
    ])
  }

  if (isLoading || name === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Editar mascota</Text>
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
        {/* Photos */}
        <View style={styles.field}>
          <Text style={styles.label}>Fotos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosRow}>
            {(photos ?? []).map((url) => (
              <TouchableOpacity
                key={url}
                onLongPress={() =>
                  Alert.alert('Eliminar foto', '¿Querés quitar esta foto?', [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Eliminar', style: 'destructive', onPress: () => handleRemovePhoto(url) },
                  ])
                }
                style={styles.photoThumb}
              >
                <Image source={{ uri: url }} style={styles.photoImage} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.addPhotoBtn} onPress={handleAddPhoto} disabled={uploading}>
              {uploading
                ? <ActivityIndicator color={Colors.primary} />
                : <Text style={styles.addPhotoIcon}>📷</Text>
              }
              <Text style={styles.addPhotoText}>Agregar</Text>
            </TouchableOpacity>
          </ScrollView>
          <Text style={styles.photoHint}>Mantené presionada una foto para eliminarla</Text>
        </View>

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
  inner: { padding: 20, gap: 20, paddingBottom: 48 },
  field: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text },

  photosRow: { flexDirection: 'row' },
  photoThumb: { marginRight: 10 },
  photoImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addPhotoBtn: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  addPhotoIcon: { fontSize: 22 },
  addPhotoText: { fontSize: 10, color: Colors.textMuted },
  photoHint: { fontSize: 11, color: Colors.textDisabled },

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
