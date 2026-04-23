import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import type { Profile, VetProfile, ClinicProfile, OrganizationProfile } from '@/types'
import { supabase } from '@/lib/supabase'

interface AuthStore {
  session: Session | null
  profile: Profile | null
  vetProfile: VetProfile | null
  clinicProfile: ClinicProfile | null
  organizationProfile: OrganizationProfile | null
  isLoading: boolean

  setSession: (session: Session | null) => void
  setProfile: (profile: Profile | null) => void
  setVetProfile: (vp: VetProfile | null) => void
  setClinicProfile: (cp: ClinicProfile | null) => void
  fetchProfile: (userId: string) => Promise<void>
  signOut: () => Promise<void>
  reset: () => void
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  session: null,
  profile: null,
  vetProfile: null,
  clinicProfile: null,
  organizationProfile: null,
  isLoading: true,

  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setVetProfile: (vetProfile) => set({ vetProfile }),
  setClinicProfile: (clinicProfile) => set({ clinicProfile }),

  fetchProfile: async (userId: string) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (!profile) {
      set({ isLoading: false })
      return
    }

    set({ profile })

    if (profile.type === 'vet') {
      const { data: vp } = await supabase
        .from('vet_profiles')
        .select('*')
        .eq('profile_id', profile.id)
        .single()
      set({ vetProfile: vp ?? null })
    }

    if (profile.type === 'clinic') {
      const { data: cp } = await supabase
        .from('clinic_profiles')
        .select('*')
        .eq('profile_id', profile.id)
        .single()
      set({ clinicProfile: cp ?? null })
    }

    if (profile.type === 'fundacion') {
      const { data: org } = await supabase
        .from('organization_profiles')
        .select('*')
        .eq('profile_id', profile.id)
        .single()
      set({ organizationProfile: org ?? null })
    } else {
      set({ organizationProfile: null })
    }

    set({ isLoading: false })
  },

  signOut: async () => {
    await supabase.auth.signOut()
    get().reset()
  },

  reset: () =>
    set({
      session: null,
      profile: null,
      vetProfile: null,
      clinicProfile: null,
      organizationProfile: null,
      isLoading: false,
    }),
}))
