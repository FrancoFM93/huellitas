import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Colors } from '@/constants/colors'
import type { Pet } from '@/types'

const SPECIES_ICONS: Record<string, string> = {
  dog: '🐶', cat: '🐱', bird: '🐦', rabbit: '🐰', other: '🐾',
}

export default function PetDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { profile } = useAuthStore()
  const qc = useQueryClient()

  const { data: pet, isLoading } = useQuery({
    queryKey: ['pet', id],
    queryFn: async () => {
      const { data } = await supabase.from('pets').select('*').eq('id', id).single()
      return data as Pet
    },
  })

  const foundMutation = useMutation({
    mutationFn: async () => {
      await supabase.from('pets').update({ is_missing: false }).eq('id', id)
      await supabase
        .from('missing_pet_reports')
        .update({ status: 'found' })
        .eq('pet_id', id)
        .eq('status', 'active')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pet', id] })
      Alert.alert('¡Qué alegría!', `Marcamos a ${pet?.name} como encontrado/a.`)
    },
    onError: (e: Error) => Alert.alert('Error', e.message),
  })

  if (isLoading || !pet) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    )
  }

  const isOwner = profile?.id === pet.owner_id

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        {isOwner && (
          <TouchableOpacity onPress={() => router.push(`/pets/edit/${id}`)}>
            <Text style={styles.editText}>Editar</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroIcon}>{SPECIES_ICONS[pet.species]}</Text>
          {pet.is_missing && (
            <View style={styles.missingBanner}>
              <Text style={styles.missingBannerText}>🔍 MASCOTA PERDIDA</Text>
            </View>
          )}
          <Text style={styles.petName}>{pet.name}</Text>
          <Text style={styles.petBreed}>{pet.breed ?? pet.species}</Text>
        </View>

        <View style={styles.infoGrid}>
          {pet.color && <InfoChip label="Color" value={pet.color} />}
          {(pet.age_years !== null || pet.age_months !== null) && (
            <InfoChip
              label="Edad"
              value={[
                pet.age_years ? `${pet.age_years} años` : '',
                pet.age_months ? `${pet.age_months} meses` : '',
              ].filter(Boolean).join(' ')}
            />
          )}
          {pet.weight_kg && <InfoChip label="Peso" value={`${pet.weight_kg} kg`} />}
          {pet.microchip && <InfoChip label="Microchip" value={pet.microchip} />}
        </View>

        {pet.medical_notes && (
          <View style={styles.medCard}>
            <Text style={styles.medTitle}>🏥 Notas médicas</Text>
            <Text style={styles.medText}>{pet.medical_notes}</Text>
          </View>
        )}

        {isOwner && (
          <View style={styles.actions}>
            {!pet.is_missing ? (
              <TouchableOpacity
                style={styles.btnWarning}
                onPress={() => router.push(`/missing/new/${id}`)}
              >
                <Text style={styles.btnWarningText}>🔍 Reportar como perdido</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.btnSuccess}
                onPress={() => foundMutation.mutate()}
              >
                <Text style={styles.btnSuccessText}>✅ Marcar como encontrado</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={styles.chipValue}>{value}</Text>
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
  backText: { color: Colors.primary, fontSize: 15, fontWeight: '500' },
  editText: { color: Colors.primary, fontSize: 15, fontWeight: '600' },
  inner: { padding: 20, gap: 20, paddingBottom: 40 },
  hero: { alignItems: 'center', gap: 8 },
  heroIcon: { fontSize: 80 },
  missingBanner: { backgroundColor: Colors.warningLight, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 5 },
  missingBannerText: { color: Colors.warning, fontSize: 13, fontWeight: '800' },
  petName: { fontSize: 28, fontWeight: '800', color: Colors.text },
  petBreed: { fontSize: 16, color: Colors.textSecondary },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: '45%',
    flex: 1,
  },
  chipLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  chipValue: { fontSize: 14, color: Colors.text, fontWeight: '600', marginTop: 3 },
  medCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, gap: 8, borderWidth: 1, borderColor: Colors.border },
  medTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  medText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  actions: { gap: 10 },
  btnWarning: {
    backgroundColor: Colors.warningLight,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.warning + '60',
  },
  btnWarningText: { color: Colors.warning, fontSize: 15, fontWeight: '700' },
  btnSuccess: {
    backgroundColor: Colors.successLight,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.success + '60',
  },
  btnSuccessText: { color: Colors.success, fontSize: 15, fontWeight: '700' },
})
