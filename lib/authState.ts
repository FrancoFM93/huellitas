import type { Session } from '@supabase/supabase-js'
import type { StateCreator } from 'zustand'
import type { Profile, VetProfile, ClinicProfile, OrganizationProfile } from '../types'

export interface AuthProfiles {
  profile: Profile | null
  vetProfile: VetProfile | null
  clinicProfile: ClinicProfile | null
  organizationProfile: OrganizationProfile | null
}

export interface AuthStore extends AuthProfiles {
  session: Session | null
  isLoading: boolean
  profileError: string | null
  setSession: (session: Session | null) => void
  setProfile: (profile: Profile | null) => void
  setVetProfile: (profile: VetProfile | null) => void
  setClinicProfile: (profile: ClinicProfile | null) => void
  fetchProfile: (userId: string) => Promise<void>
  signOut: () => Promise<void>
  reset: () => void
}

const emptyProfiles: AuthProfiles = {
  profile: null,
  vetProfile: null,
  clinicProfile: null,
  organizationProfile: null,
}

interface Dependencies {
  loadProfile: (userId: string) => Promise<AuthProfiles>
  signOut: () => Promise<void>
  clearUserData: () => void
}

// Prevent slow responses from a previous account or signed-out session from
// repopulating the app. Injected dependencies allow device-free lifecycle tests.
export function createAuthState(deps: Dependencies): StateCreator<AuthStore> {
  let epoch = 0
  let pending: { userId: string; epoch: number; promise: Promise<void> } | null = null

  return (set, get) => ({
    ...emptyProfiles,
    session: null,
    isLoading: true,
    profileError: null,

    setSession(session) {
      const changed = get().session?.user.id !== session?.user.id
      if (changed) {
        epoch += 1
        pending = null
        deps.clearUserData()
      }
      set({
        session,
        ...(changed ? { ...emptyProfiles, profileError: null, isLoading: !!session } : {}),
      })
    },

    setProfile: profile => set({ profile }),
    setVetProfile: vetProfile => set({ vetProfile }),
    setClinicProfile: clinicProfile => set({ clinicProfile }),

    fetchProfile(userId) {
      if (get().session?.user.id !== userId) return Promise.resolve()
      if (pending?.userId === userId && pending.epoch === epoch) return pending.promise
      const requestEpoch = epoch
      set({ isLoading: true, profileError: null })
      const promise = (async () => {
        try {
          const profiles = await Promise.resolve().then(() => deps.loadProfile(userId))
          if (epoch !== requestEpoch || get().session?.user.id !== userId) return
          if (!profiles.profile) throw new Error('profile_missing')
          set({ ...profiles, isLoading: false, profileError: null })
        } catch (error) {
          if (epoch !== requestEpoch || get().session?.user.id !== userId) return
          set({
            ...emptyProfiles,
            isLoading: false,
            profileError: error instanceof Error ? error.message : 'profile_load_failed',
          })
        } finally {
          if (pending?.epoch === requestEpoch && pending.userId === userId) pending = null
        }
      })()
      pending = { userId, epoch: requestEpoch, promise }
      return promise
    },

    async signOut() {
      await deps.signOut()
      get().reset()
    },

    reset() {
      epoch += 1
      pending = null
      deps.clearUserData()
      set({ ...emptyProfiles, session: null, isLoading: false, profileError: null })
    },
  })
}
