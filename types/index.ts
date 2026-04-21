// ─── Profile ─────────────────────────────────────────────────────────────────

export type ProfileType = 'user' | 'vet' | 'clinic' | 'fundacion'
export type ProfileRole = 'user' | 'admin'

export interface GeoPoint {
  lat: number
  lng: number
  address: string
}

export interface DaySchedule {
  open: string   // "09:00"
  close: string  // "18:00"
  closed: boolean
}

export interface WeeklySchedule {
  monday?: DaySchedule
  tuesday?: DaySchedule
  wednesday?: DaySchedule
  thursday?: DaySchedule
  friday?: DaySchedule
  saturday?: DaySchedule
  sunday?: DaySchedule
}

export interface Profile {
  id: string
  user_id: string
  type: ProfileType
  role: ProfileRole
  verified: boolean
  name: string
  avatar_url: string | null
  bio: string | null
  location: GeoPoint | null
  phone: string | null
  country: string | null
  region: string | null
  city_slug: string | null
  created_at: string
}

export interface VetProfile {
  id: string
  profile_id: string
  license_number: string
  specialties: string[]
  consultation_fee: number | null
  available: boolean
  schedule: WeeklySchedule
  phone: string | null
  email: string | null
  website: string | null
}

export interface ClinicProfile {
  id: string
  profile_id: string
  address: string
  phone: string
  email: string | null
  website: string | null
  schedule: WeeklySchedule
  services: string[]
  emergency_24h: boolean
}

export interface VetWithProfile extends VetProfile {
  profile: Profile
}

export interface ClinicWithProfile extends ClinicProfile {
  profile: Profile
}

// ─── Pets ─────────────────────────────────────────────────────────────────────

export type PetSpecies = 'dog' | 'cat' | 'bird' | 'rabbit' | 'other'

export interface Pet {
  id: string
  owner_id: string
  name: string
  species: PetSpecies
  breed: string | null
  age_years: number | null
  age_months: number | null
  weight_kg: number | null
  color: string
  photos: string[]
  microchip: string | null
  medical_notes: string | null
  is_missing: boolean
  created_at: string
}

export interface MissingPetReport {
  id: string
  pet_id: string
  reporter_id: string
  last_seen_lat: number
  last_seen_lng: number
  last_seen_address: string
  last_seen_at: string
  description: string
  status: 'active' | 'found' | 'closed'
  sightings_count: number
  created_at: string
  pet?: Pet
  reporter?: Profile
}

export interface PetSighting {
  id: string
  report_id: string
  reporter_id: string
  lat: number
  lng: number
  address: string
  photo_url: string | null
  notes: string
  created_at: string
  reporter?: Profile
}

// ─── Community Alerts ─────────────────────────────────────────────────────────

export type AlertSeverity = 1 | 2 | 3 | 4 | 5
export type AlertStatus = 'active' | 'in_progress' | 'resolved'
export type AlertCategory = 'lost' | 'injury' | 'abuse' | 'abandonment' | 'emergency' | 'catastrophe'

export interface CommunityAlert {
  id: string
  creator_id: string
  title: string
  description: string
  category: AlertCategory
  severity: AlertSeverity
  lat: number
  lng: number
  address: string
  photos: string[]
  status: AlertStatus
  responses_count: number
  created_at: string
  updated_at: string
  creator?: Profile
}

export interface AlertResponse {
  id: string
  alert_id: string
  responder_id: string
  message: string
  status: 'offered' | 'accepted' | 'completed'
  created_at: string
  responder?: Profile
}

// ─── Fundraising ──────────────────────────────────────────────────────────────

export type FundraiserBeneficiary = 'person' | 'animal' | 'emergency_fund'
export type FundraiserStatus = 'active' | 'completed' | 'cancelled'

export interface Fundraiser {
  id: string
  creator_id: string
  title: string
  description: string
  beneficiary_type: FundraiserBeneficiary
  target_amount: number
  current_amount: number
  cover_photo: string | null
  status: FundraiserStatus
  created_at: string
  updated_at: string
  creator?: Profile
}

export interface Donation {
  id: string
  fundraiser_id: string | null
  donor_id: string
  amount: number
  anonymous: boolean
  message: string | null
  created_at: string
}

export interface EmergencyFund {
  total_amount: number
  transactions_count: number
  last_updated: string
}

export interface EmergencyFundTransaction {
  id: string
  amount: number
  type: 'deposit' | 'withdrawal'
  description: string
  created_at: string
  donor_id: string | null
  donor?: Profile
}

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationType =
  | 'missing_pet_near_you'
  | 'pet_sighting'
  | 'community_alert'
  | 'alert_response'
  | 'donation_received'
  | 'fundraiser_update'
  | 'vet_message'
  | 'new_fundraiser'

export interface AppNotification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string
  read: boolean
  metadata: Record<string, unknown>
  created_at: string
}

// ─── Adoption ────────────────────────────────────────────────────────────────

export type AgeRange = 'puppy' | 'young' | 'adult' | 'senior'
export type AdoptionStatus = 'available' | 'reserved' | 'adopted'

export interface AdoptionPost {
  id: string
  poster_id: string
  name: string
  species: PetSpecies
  breed: string | null
  age_range: AgeRange
  color: string | null
  description: string
  location: string
  contact_info: string
  photos: string[]
  is_vaccinated: boolean
  is_neutered: boolean
  is_dewormed: boolean
  good_with_kids: boolean
  good_with_pets: boolean
  status: AdoptionStatus
  created_at: string
  updated_at: string
  poster?: Profile
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthState {
  session: import('@supabase/supabase-js').Session | null
  profile: Profile | null
  vetProfile: VetProfile | null
  clinicProfile: ClinicProfile | null
  isLoading: boolean
}

// ─── Org / Enum / Geo types (migration 1.2) ──────────────────────────────────

export type CatastropheSubtype = 'earthquake' | 'flood' | 'fire' | 'other'
export type BroadcastScope = 'city' | 'region' | 'country'
export type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn'
export type ContractStatus = 'active' | 'completed' | 'cancelled'
export type SessionType = 'photo' | 'video'
export type SessionStatus = 'scheduled' | 'completed' | 'missed'
export type AdoptionSex = 'male' | 'female' | 'unknown'
export type AdoptionHealth = 'healthy' | 'treatment' | 'chronic' | 'special_needs'

export interface OrganizationProfile {
  id: string
  profile_id: string
  org_name: string
  logo_url: string | null
  description: string | null
  contact_email: string | null
  contact_phone: string | null
  website: string | null
  address: string | null
  gps: { lat: number; lng: number } | null
  created_at: string
  updated_at: string
}

export interface OrgWithProfile extends OrganizationProfile {
  profile: Profile
}
