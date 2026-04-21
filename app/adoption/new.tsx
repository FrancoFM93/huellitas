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
import type { PetSpecies } from '@/types'

const SPECIES: { value: PetSpecies; label: string; icon: string }[] = [
  { value: 'dog', label: 'Perro', icon: '🐶' },
  { value: 'cat', label: 'Gato', icon: '🐱' },
  { value: 'bird', label: 'Ave', icon: '🐦' },
  { value: 'rabbit', label: 'Conejo', icon: '🐰' },
  { value: 'other', label: 'Otro', icon: '🐾' },
]

const AGE_RANGES: { value: string; label: string; desc: string }[] = [
  { value: 'puppy', label: 'Cachorro', desc: '0 – 1 año' },
  { value: 'young', label: 'Joven', desc: '1 – 3 años' },
  { value: 'adult', label: 'Adulto', desc: '3 – 8 años' },
  { value: 'senior', label: 'Mayor', desc: '8+ años' },
]

export default function NewAdoption() {
  const { profile } = useAuthStore()
  const [species, setSpecies] = useState<PetSpecies>('dog')
  const [name, setName] = useState('')
  const [breed, setBreed] = useState('')
  const [ageRange, setAgeRange] = useState('puppy')
  const [color, setColor] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [contactInfo, setContactInfo] = useState('')
  const [isVaccinated, setIsVaccinated] = useState(false)
  const [isNeutered, setIsNeutered] = useState(false)
  const [isDewormed, setIsDewormed] = useState(false)
  const [goodWithKids, setGoodWithKids] = useState(false)
  const [goodWithPets, setGoodWithPets] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!name.trim() || !description.trim() || !location.trim() || !contactInfo.trim()) {
      Alert.alert('Campos requeridos', 'Completa nombre, descripción, zona y contacto')
      return
    }
    if (!profile) return

    setLoading(true)
    const { error } = await supabase.from('adoption_posts').insert({
      poster_id: profile.id,
      name: name.trim(),
      species,
      breed: breed.trim() || null,
      age_range: ageRange,
      color: color.trim() || null,
      description: description.trim(),
      location: location.trim(),
      contact_info: contactInfo.trim(),
      photos: [],
      is_vaccinated: isVaccinated,
      is_neutered: isNeutered,
      is_dewormed: isDewormed,
      good_with_kids: goodWithKids,
      good_with_pets: goodWithPets,
      status: 'available',
    })
    setLoading(false)

    if (error) {
      Alert.alert('Error', error.message)
      return
    }

    Alert.alert(
      '¡Publicación creada!',
      `${name} ya está visible para toda la comunidad.`,
      [{ text: 'OK', onPress: () => router.replace('/(tabs)/adopt') }]
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Dar en adopción</Text>
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

        {/* Name */}
        <View style={styles.field}>
          <Text style={styles.label}>Nombre o apodo *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="¿Cómo se llama?"
            placeholderTextColor={Colors.textDisabled}
            autoCapitalize="words"
          />
        </View>

        {/* Breed */}
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

        {/* Age range */}
        <View style={styles.field}>
          <Text style={styles.label}>Edad aproximada</Text>
          <View style={styles.ageRow}>
            {AGE_RANGES.map(({ value, label, desc }) => (
              <TouchableOpacity
                key={value}
                style={[styles.ageBtn, ageRange === value && styles.ageBtnActive]}
                onPress={() => setAgeRange(value)}
              >
                <Text style={[styles.ageLabel, ageRange === value && styles.ageLabelActive]}>
                  {label}
                </Text>
                <Text style={styles.ageDesc}>{desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Color */}
        <View style={styles.field}>
          <Text style={styles.label}>Color / descripción física</Text>
          <TextInput
            style={styles.input}
            value={color}
            onChangeText={setColor}
            placeholder="Ej: Marrón con manchas blancas"
            placeholderTextColor={Colors.textDisabled}
          />
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.label}>Descripción *</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Cuéntanos sobre su personalidad, historia, necesidades especiales..."
            placeholderTextColor={Colors.textDisabled}
            multiline
            textAlignVertical="top"
            maxLength={800}
          />
          <Text style={styles.charCount}>{description.length}/800</Text>
        </View>

        {/* Health & behavior toggles */}
        <View style={styles.field}>
          <Text style={styles.label}>Salud y comportamiento</Text>
          <View style={styles.togglesCard}>
            <ToggleRow
              label="💉 Vacunado/a"
              value={isVaccinated}
              onValueChange={setIsVaccinated}
            />
            <View style={styles.divider} />
            <ToggleRow
              label="✂️ Castrado/a o esterilizado/a"
              value={isNeutered}
              onValueChange={setIsNeutered}
            />
            <View style={styles.divider} />
            <ToggleRow
              label="💊 Desparasitado/a"
              value={isDewormed}
              onValueChange={setIsDewormed}
            />
            <View style={styles.divider} />
            <ToggleRow
              label="👶 Bueno/a con niños"
              value={goodWithKids}
              onValueChange={setGoodWithKids}
            />
            <View style={styles.divider} />
            <ToggleRow
              label="🐾 Bueno/a con otras mascotas"
              value={goodWithPets}
              onValueChange={setGoodWithPets}
            />
          </View>
        </View>

        {/* Location */}
        <View style={styles.field}>
          <Text style={styles.label}>Zona / Barrio *</Text>
          <TextInput
            style={styles.input}
            value={location}
            onChangeText={setLocation}
            placeholder="Ej: Palermo, Buenos Aires"
            placeholderTextColor={Colors.textDisabled}
            autoCapitalize="words"
          />
        </View>

        {/* Contact */}
        <View style={styles.field}>
          <Text style={styles.label}>Información de contacto *</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={contactInfo}
            onChangeText={setContactInfo}
            placeholder="WhatsApp, teléfono, Instagram o email para que los interesados se comuniquen"
            placeholderTextColor={Colors.textDisabled}
            multiline
            textAlignVertical="top"
          />
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            🐾 Al publicar, te comprometés a realizar un proceso de adopción responsable.
            Podés pedir referencias, hacer entrevistas y hacer seguimiento post-adopción.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function ToggleRow({
  label, value, onValueChange,
}: {
  label: string
  value: boolean
  onValueChange: (v: boolean) => void
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
  inner: { padding: 20, gap: 22, paddingBottom: 48 },
  field: { gap: 10 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text },
  speciesRow: { flexDirection: 'row', gap: 8 },
  speciesBtn: {
    flex: 1, alignItems: 'center', padding: 10,
    borderRadius: 12, backgroundColor: Colors.surface,
    borderWidth: 1.5, borderColor: Colors.border, gap: 4,
  },
  speciesBtnActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  speciesIcon: { fontSize: 22 },
  speciesLabel: { fontSize: 10, color: Colors.textSecondary, fontWeight: '500' },
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
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: Colors.textDisabled, textAlign: 'right' },
  ageRow: { flexDirection: 'row', gap: 8 },
  ageBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRadius: 12, backgroundColor: Colors.surface,
    borderWidth: 1.5, borderColor: Colors.border, gap: 2,
  },
  ageBtnActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  ageLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  ageLabelActive: { color: Colors.primaryDark },
  ageDesc: { fontSize: 10, color: Colors.textMuted },
  togglesCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  toggleLabel: { fontSize: 14, color: Colors.text },
  divider: { height: 1, backgroundColor: Colors.borderLight, marginHorizontal: 16 },
  notice: { backgroundColor: Colors.primaryLight, borderRadius: 12, padding: 14 },
  noticeText: { fontSize: 13, color: Colors.primaryDark, lineHeight: 20 },
})
