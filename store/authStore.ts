import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { queryClient } from '@/lib/queryClient'
import { createAuthState, type AuthProfiles, type AuthStore } from '@/lib/authState'
import { useNotificationStore } from '@/store/notificationStore'

export const useAuthStore = create<AuthStore>(createAuthState({
  async loadProfile(userId) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, user_id, type, role, verified, name, avatar_url, bio, location, phone, country, region, city_slug, created_at, deleted_at')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw error
    if (profile?.deleted_at) throw new Error('account_deleted')

    const result: AuthProfiles = {
      profile,
      vetProfile: null,
      clinicProfile: null,
      organizationProfile: null,
    }
    if (!profile) return result

    const table = profile.type === 'vet' ? 'vet_profiles'
      : profile.type === 'clinic' ? 'clinic_profiles'
      : profile.type === 'fundacion' ? 'organization_profiles' : null
    if (table) {
      const { data, error: detailError } = await supabase
        .from(table).select('*').eq('profile_id', profile.id).maybeSingle()
      if (detailError) throw detailError
      if (profile.type === 'vet') result.vetProfile = data
      if (profile.type === 'clinic') result.clinicProfile = data
      if (profile.type === 'fundacion') result.organizationProfile = data
    }
    return result
  },

  async signOut() {
    // Best effort while authenticated. Per-device tokens remain a release task.
    const profileId = useAuthStore.getState().profile?.id
    if (profileId) {
      await supabase.from('profiles').update({ push_token: null }).eq('id', profileId)
        .then(() => undefined, () => undefined)
    }
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) throw error
  },

  clearUserData() {
    queryClient.clear()
    useNotificationStore.getState().unsubscribe()
  },
}))
