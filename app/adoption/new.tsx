import { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, Switch, Image,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { usePhotoUpload } from '@/lib/usePhotoUpload'
import { Colors } from '@/constants/colors'
import type { PetSpecies } from '@/types'

const MAX_PHOTOS = 5


export default function NewAdoption() {
  const { t } = useTranslation()
  const { profile } = useAuthStore()

  const SPECIES: { value: PetSpecies; label: string; icon: string }[] = [
    { value: 'dog', label: t('pets.dog'), icon: '🐶' },
    { value: 'cat', label: t('pets.cat'), icon: '🐱' },
    { value: 'bird', label: t('pets.bird'), icon: '🐦' },
    { value: 'rabbit', label: t('pets.rabbit'), icon: '🐰' },
    { value: 'other', label: t('pets.other'), icon: '🐾' },
  ]
  const AGE_RANGES = [
    { value: 'puppy',  label: t('adoption.age_puppy_label',  { defaultValue: 'Cachorro' }), desc: '0 – 1' },
    { value: 'young',  label: t('adoption.age_young_label',  { defaultValue: 'Joven' }),    desc: '1 – 3' },
    { value: 'adult',  label: t('adoption.age_adult_label',  { defaultValue: 'Adulto' }),   desc: '3 – 8' },
    { value: 'senior', label: t('adoption.age_senior_label', { defaultValue: 'Mayor' }),    desc: '8+' },
  ]
  const SEX_OPTIONS: { value: 'male' | 'female' | 'unknown'; label: string; icon: string }[] = [
    { value: 'male',    label: t('adoption.sex_male'),    icon: '♂' },
    { value: 'female',  label: t('adoption.sex_female'),  icon: '♀' },
    { value: 'unknown', label: t('adoption.sex_unknown'), icon: '?' },
  ]
  const HEALTH_OPTIONS: { value: 'healthy' | 'treatment' | 'chronic' | 'special_needs'; label: string; desc: string }[] = [
    { value: 'healthy',        label: t('adoption.health_healthy'),     desc: t('adoption.health_healthy_desc') },
    { value: 'treatment',      label: t('adoption.health_treatment'),   desc: t('adoption.health_treatment_desc') },
    { value: 'chronic',        label: t('adoption.health_chronic'),     desc: t('adoption.health_chronic_desc') },
    { value: 'special_needs',  label: t('adoption.health_special'),     desc: t('adoption.health_special_desc') },
  ]
  const [species, setSpecies] = useState<PetSpecies>('dog')
  const [name, setName] = useState('')
  const [breed, setBreed] = useState('')
  const [ageRange, setAgeRange] = useState('puppy')
  const [sex, setSex] = useState<'male' | 'female' | 'unknown'>('unknown')
  const [healthStatus, setHealthStatus] = useState<'healthy' | 'treatment' | 'chronic' | 'special_needs'>('healthy')
  const [color, setColor] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [contactInfo, setContactInfo] = useState('')
  const [isVaccinated, setIsVaccinated] = useState(false)
  const [isNeutered, setIsNeutered] = useState(false)
  const [isDewormed, setIsDewormed] = useState(false)
  const [goodWithKids, setGoodWithKids] = useState(false)
  const [goodWithPets, setGoodWithPets] = useState(false)
  const [photos, setPhotos] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const { upload, uploading } = usePhotoUpload()

  const addPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert(t('adoption.photos_max_title'), t('adoption.photos_max_msg', { count: MAX_PHOTOS }))
      return
    }
    const url = await upload({ folder: 'adoption', allowsEditing: false })
    if (url) setPhotos((prev) => [...prev, url])
  }

  const removePhoto = (url: string) => setPhotos((prev) => prev.filter((p) => p !== url))

  const handleSubmit = async () => {
    if (!name.trim() || !description.trim() || !location.trim() || !contactInfo.trim()) {
      Alert.alert(t('common.required_fields'), t('adoption.required_msg', { defaultValue: 'Completa nombre, descripción, zona y contacto' }))
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
      sex,
      health_status: healthStatus,
      color: color.trim() || null,
      description: description.trim(),
      location: location.trim(),
      contact_info: contactInfo.trim(),
      photos,
      is_vaccinated: isVaccinated,
      is_neutered: isNeutered,
      is_dewormed: isDewormed,
      good_with_kids: goodWithKids,
      good_with_pets: goodWithPets,
      status: 'available',
    })
    setLoading(false)

    if (error) {
      Alert.alert(t('common.error'), error.message)
      return
    }

    Alert.alert(
      t('adoption.created'),
      t('adoption.created_msg', { name }),
      [{ text: 'OK', onPress: () => router.replace('/(tabs)/adopt') }]
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{t('adoption.new_title')}</Text>
        <TouchableOpacity onPress={handleSubmit} disabled={loading}>
          {loading
            ? <ActivityIndicator color={Colors.primary} size="small" />
            : <Text style={styles.publishText}>{t('common.publish')}</Text>
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
          <Text style={styles.label}>{t('adoption.species')}</Text>
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

        {/* Photos */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('adoption.photos_label')}</Text>
          <Text style={styles.hint}>{t('adoption.photos_hint', { count: MAX_PHOTOS })}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosRow}>
            {photos.map((url) => (
              <View key={url} style={styles.photoThumb}>
                <Image source={{ uri: url }} style={styles.photoImg} />
                <TouchableOpacity style={styles.photoRemove} onPress={() => removePhoto(url)}>
                  <Text style={styles.photoRemoveText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < MAX_PHOTOS && (
              <TouchableOpacity
                style={[styles.photoAdd, uploading && styles.photoAddDisabled]}
                onPress={addPhoto}
                disabled={uploading}
              >
                {uploading
                  ? <ActivityIndicator color={Colors.primary} />
                  : <>
                      <Text style={styles.photoAddIcon}>＋</Text>
                      <Text style={styles.photoAddText}>{t('adoption.photo_add')}</Text>
                    </>}
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        {/* Name */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('adoption.name')}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t('adoption.name_placeholder')}
            placeholderTextColor={Colors.textDisabled}
            autoCapitalize="words"
          />
        </View>

        {/* Breed */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('adoption.breed')}</Text>
          <TextInput
            style={styles.input}
            value={breed}
            onChangeText={setBreed}
            placeholder={t('adoption.breed_placeholder')}
            placeholderTextColor={Colors.textDisabled}
            autoCapitalize="words"
          />
        </View>

        {/* Age range */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('adoption.age')}</Text>
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

        {/* Sex */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('adoption.sex_label')}</Text>
          <View style={styles.ageRow}>
            {SEX_OPTIONS.map(({ value, label, icon }) => (
              <TouchableOpacity
                key={value}
                style={[styles.ageBtn, sex === value && styles.ageBtnActive]}
                onPress={() => setSex(value)}
              >
                <Text style={[styles.sexIcon, sex === value && styles.ageLabelActive]}>{icon}</Text>
                <Text style={[styles.ageLabel, sex === value && styles.ageLabelActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Color */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('adoption.color')}</Text>
          <TextInput
            style={styles.input}
            value={color}
            onChangeText={setColor}
            placeholder={t('adoption.color_placeholder')}
            placeholderTextColor={Colors.textDisabled}
          />
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('adoption.description')}</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder={t('adoption.description_placeholder')}
            placeholderTextColor={Colors.textDisabled}
            multiline
            textAlignVertical="top"
            maxLength={800}
          />
          <Text style={styles.charCount}>{description.length}/800</Text>
        </View>

        {/* Health & behavior toggles */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('adoption.health')}</Text>
          <View style={styles.togglesCard}>
            <ToggleRow
              label={t('adoption.vaccinated')}
              value={isVaccinated}
              onValueChange={setIsVaccinated}
            />
            <View style={styles.divider} />
            <ToggleRow
              label={t('adoption.neutered')}
              value={isNeutered}
              onValueChange={setIsNeutered}
            />
            <View style={styles.divider} />
            <ToggleRow
              label={t('adoption.dewormed')}
              value={isDewormed}
              onValueChange={setIsDewormed}
            />
            <View style={styles.divider} />
            <ToggleRow
              label={t('adoption.good_with_kids')}
              value={goodWithKids}
              onValueChange={setGoodWithKids}
            />
            <View style={styles.divider} />
            <ToggleRow
              label={t('adoption.good_with_pets')}
              value={goodWithPets}
              onValueChange={setGoodWithPets}
            />
          </View>
        </View>

        {/* Health status */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('adoption.health_status')}</Text>
          <View style={styles.healthCol}>
            {HEALTH_OPTIONS.map(({ value, label, desc }) => (
              <TouchableOpacity
                key={value}
                style={[styles.healthBtn, healthStatus === value && styles.healthBtnActive]}
                onPress={() => setHealthStatus(value)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.healthLabel, healthStatus === value && styles.healthLabelActive]}>
                    {label}
                  </Text>
                  <Text style={styles.healthDesc}>{desc}</Text>
                </View>
                {healthStatus === value && <Text style={styles.healthCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Location */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('adoption.zone')}</Text>
          <TextInput
            style={styles.input}
            value={location}
            onChangeText={setLocation}
            placeholder={t('adoption.zone_placeholder')}
            placeholderTextColor={Colors.textDisabled}
            autoCapitalize="words"
          />
        </View>

        {/* Contact */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('adoption.contact')}</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={contactInfo}
            onChangeText={setContactInfo}
            placeholder={t('adoption.contact_placeholder')}
            placeholderTextColor={Colors.textDisabled}
            multiline
            textAlignVertical="top"
          />
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeText}>{t('adoption.notice')}</Text>
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
  sexIcon: { fontSize: 18, fontWeight: '800', color: Colors.textSecondary },
  healthCol: { gap: 8 },
  healthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  healthBtnActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  healthLabel: { fontSize: 14, fontWeight: '700', color: Colors.text },
  healthLabelActive: { color: Colors.primaryDark },
  healthDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  healthCheck: { fontSize: 18, color: Colors.primary, fontWeight: '800' },
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
  hint: { fontSize: 12, color: Colors.textMuted, lineHeight: 17 },
  photosRow: { flexDirection: 'row', marginTop: 6 },
  photoThumb: {
    width: 90, height: 90, borderRadius: 12, marginRight: 8,
    backgroundColor: Colors.borderLight, position: 'relative',
  },
  photoImg: { width: '100%', height: '100%', borderRadius: 12 },
  photoRemove: {
    position: 'absolute', top: -6, right: -6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.alert, justifyContent: 'center', alignItems: 'center',
  },
  photoRemoveText: { color: Colors.white, fontSize: 14, fontWeight: '800', lineHeight: 16 },
  photoAdd: {
    width: 90, height: 90, borderRadius: 12,
    borderWidth: 2, borderColor: Colors.primary, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', gap: 2,
  },
  photoAddDisabled: { opacity: 0.6 },
  photoAddIcon: { fontSize: 28, color: Colors.primary, fontWeight: '300' },
  photoAddText: { fontSize: 11, color: Colors.primary, fontWeight: '600' },
})
