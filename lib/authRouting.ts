import type { AuthProfiles } from './authState'

export function getPostLoginRoute(state: AuthProfiles & { profileError: string | null }) {
  if (!state.profile || state.profileError) return '/' as const
  if (state.profile.type === 'vet' && !state.vetProfile) return '/(auth)/onboarding' as const
  if (state.profile.type === 'clinic' && !state.clinicProfile) return '/(auth)/onboarding' as const
  if (state.profile.type === 'fundacion' && !state.organizationProfile) return '/(auth)/onboarding' as const
  return '/(tabs)' as const
}
