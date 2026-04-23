import { View, Text, ScrollView, Image, TouchableOpacity, Linking, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Colors } from '@/constants/colors'
import type { OrgWithProfile, AdoptionPost, Fundraiser } from '@/types'

export default function OrgDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()

  const { data: org } = useQuery({
    queryKey: ['org', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('organization_profiles')
        .select('*, profile:profiles(*)')
        .eq('profile_id', id)
        .single()
      return data as OrgWithProfile | null
    },
    enabled: !!id,
  })

  const { data: fundraisers } = useQuery({
    queryKey: ['org-fundraisers', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('fundraisers')
        .select('*')
        .eq('creator_id', id)
        .order('created_at', { ascending: false })
        .limit(10)
      return (data ?? []) as Fundraiser[]
    },
    enabled: !!id,
  })

  const { data: adoptions } = useQuery({
    queryKey: ['org-adoptions', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('adoption_posts')
        .select('*')
        .eq('poster_id', id)
        .order('created_at', { ascending: false })
        .limit(10)
      return (data ?? []) as AdoptionPost[]
    },
    enabled: !!id,
  })

  if (!org) return <SafeAreaView><Text>...</Text></SafeAreaView>

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {org.logo_url && (
          <Image
            source={{ uri: org.logo_url }}
            style={{ width: 96, height: 96, borderRadius: 48, alignSelf: 'center' }}
          />
        )}
        <Text style={{ fontSize: 22, fontWeight: '700', textAlign: 'center', color: Colors.text }}>
          {org.org_name}{org.profile.verified ? ' ✓' : ''}
        </Text>
        {org.description ? (
          <Text style={{ color: Colors.textSecondary }}>{org.description}</Text>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
          {org.contact_email ? (
            <TouchableOpacity
              onPress={() => Linking.openURL(`mailto:${org.contact_email}`)}
              style={styles.btn}
            >
              <Text>✉️</Text>
            </TouchableOpacity>
          ) : null}
          {org.contact_phone ? (
            <TouchableOpacity
              onPress={() => Linking.openURL(`tel:${org.contact_phone}`)}
              style={styles.btn}
            >
              <Text>📞</Text>
            </TouchableOpacity>
          ) : null}
          {org.website ? (
            <TouchableOpacity
              onPress={() => Linking.openURL(org.website!)}
              style={styles.btn}
            >
              <Text>🌐</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={styles.section}>Campañas activas</Text>
        {(fundraisers ?? []).map(f => (
          <TouchableOpacity
            key={f.id}
            onPress={() => router.push(`/fundraising/${f.id}`)}
            style={styles.row}
          >
            <Text style={{ color: Colors.text }}>{f.title}</Text>
          </TouchableOpacity>
        ))}
        {(!fundraisers || fundraisers.length === 0) ? (
          <Text style={{ color: Colors.textMuted }}>Sin campañas</Text>
        ) : null}

        <Text style={styles.section}>En adopción</Text>
        {(adoptions ?? []).map(a => (
          <TouchableOpacity
            key={a.id}
            onPress={() => router.push(`/adoption/${a.id}`)}
            style={styles.row}
          >
            <Text style={{ color: Colors.text }}>{a.name} — {a.species}</Text>
          </TouchableOpacity>
        ))}
        {(!adoptions || adoptions.length === 0) ? (
          <Text style={{ color: Colors.textMuted }}>Sin publicaciones de adopción</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  btn: { padding: 12, backgroundColor: Colors.surface, borderRadius: 8 },
  row: { padding: 12, backgroundColor: Colors.surface, borderRadius: 8 },
  section: { fontSize: 18, fontWeight: '600', marginTop: 12, color: Colors.text },
})
