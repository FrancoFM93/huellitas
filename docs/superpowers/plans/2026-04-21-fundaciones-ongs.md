# Fundaciones / ONGs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the fundaciones/ONGs module: new profile type, directory segment, geo-aware alert fanout, catastrophe alerts, admin emergency broadcasts, adoption applications + 1-year monitoring contracts with Jitsi video check-ins, and verified-org campaign extras.

**Architecture:** Supabase-backed. Schema extensions via additive migrations. Server-side fan-out via trigger + RPC. Client in React Native + expo-router. Video via deterministic Jitsi public rooms. Admin is a `profiles.role` flag, not a separate auth realm. Geo = `country` + `region` + `city_slug` columns, slugified client-side.

**Tech Stack:** Expo 55, expo-router, React Native 0.83.2, Supabase (Postgres + Auth + Storage + Edge Functions + pg_cron), React Query, Zustand, i18next, `react-native-webview` (add) for Jitsi embed.

**Source of truth:** [../specs/2026-04-20-fundaciones-ongs-design.md](../specs/2026-04-20-fundaciones-ongs-design.md)

**Testing note:** No existing test runner in this project. DB/RPC work is verified via SQL assertions run against local Supabase (`supabase start`). Client work is verified via manual smoke on EAS preview. Each phase lists explicit manual verification steps.

---

## File structure

**New SQL migrations** (additive, run in order, commit separately):
- `supabase/migrations/2026_04_21_01_geo_and_roles.sql`
- `supabase/migrations/2026_04_21_02_organization_profiles.sql`
- `supabase/migrations/2026_04_21_03_alerts_catastrophe.sql`
- `supabase/migrations/2026_04_21_04_emergency_broadcasts.sql`
- `supabase/migrations/2026_04_21_05_adoption_extensions.sql`
- `supabase/migrations/2026_04_21_06_adoption_applications.sql`
- `supabase/migrations/2026_04_21_07_contracts_and_monitoring.sql`
- `supabase/migrations/2026_04_21_08_campaign_extras.sql`
- `supabase/migrations/2026_04_21_09_cron_monitoring.sql`

**New lib files:**
- `lib/geoSlug.ts` — `slugify`, `parseCityInput`
- `lib/useOrgProfile.ts` — hook: load `organization_profiles` row for a profile
- `lib/jitsiRoom.ts` — `buildRoomUrl(contractId, sessionId)`

**New screens:**
- `app/(auth)/onboarding/fundacion.tsx`
- `app/orgs/[id].tsx`
- `app/adoption/apply/[postId].tsx`
- `app/adoption/contract/[contractId].tsx`
- `app/monitoring/[sessionId].tsx`
- `app/admin/_layout.tsx`
- `app/admin/broadcasts.tsx`
- `app/admin/verify.tsx`
- `app/profile/my-applications.tsx`

**Modified:**
- `supabase/schema.sql` — enum extension comment (reference only; actual change in migrations)
- `app/(auth)/type-picker.tsx`
- `app/(tabs)/search.tsx`
- `app/(tabs)/adopt.tsx`
- `app/adoption/new.tsx`
- `app/adoption/[id].tsx`
- `app/alerts/new.tsx`
- `app/fundraising/new.tsx`
- `app/fundraising/[id].tsx`
- `store/authStore.ts`
- `types/index.ts`
- `locales/es.json`
- `locales/en.json`

---

## Phase 1 — Foundation: geo + roles + fundacion profile type

### Task 1.1: Migration — geo fields + role + verified on profiles

**Files:**
- Create: `supabase/migrations/2026_04_21_01_geo_and_roles.sql`

- [ ] **Step 1: Write migration**

```sql
-- 2026_04_21_01_geo_and_roles.sql
-- Adds geo hierarchy (country/region/city_slug), role, verified flag.
-- Extends profile type enum to include 'fundacion'.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS city_slug TEXT;

-- Rewrite profile type check constraint to include 'fundacion'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_type_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_type_check
  CHECK (type IN ('user','vet','clinic','fundacion'));

CREATE INDEX IF NOT EXISTS idx_profiles_country_city ON profiles(country, city_slug);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role) WHERE role = 'admin';
```

- [ ] **Step 2: Apply migration locally**

```bash
supabase db reset     # or: psql "$SUPABASE_DB_URL" -f supabase/migrations/2026_04_21_01_geo_and_roles.sql
```

Expected: No errors. `\d profiles` shows new columns.

- [ ] **Step 3: Verify via SQL assertions**

```sql
-- Must succeed
INSERT INTO profiles (id, user_id, type, name, country, city_slug)
VALUES (uuid_generate_v4(), auth.uid(), 'fundacion', 'Test ONG', 'CL', 'santiago');

-- Must fail
INSERT INTO profiles (id, user_id, type, name) VALUES (uuid_generate_v4(), auth.uid(), 'bogus', 'x');
```

Expected: first succeeds, second raises `profiles_type_check` violation.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/2026_04_21_01_geo_and_roles.sql
git commit -m "feat(db): add geo fields, role, verified, fundacion type to profiles"
```

---

### Task 1.2: Migration — organization_profiles table

**Files:**
- Create: `supabase/migrations/2026_04_21_02_organization_profiles.sql`

- [ ] **Step 1: Write migration**

```sql
-- 2026_04_21_02_organization_profiles.sql
CREATE TABLE IF NOT EXISTS organization_profiles (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id     UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  org_name       TEXT NOT NULL,
  logo_url       TEXT,
  description    TEXT,
  contact_email  TEXT,
  contact_phone  TEXT,
  website        TEXT,
  address        TEXT,
  gps            JSONB,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_org_profiles_profile ON organization_profiles(profile_id);

ALTER TABLE organization_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_public_read" ON organization_profiles FOR SELECT USING (true);

CREATE POLICY "org_owner_insert" ON organization_profiles FOR INSERT
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "org_owner_update" ON organization_profiles FOR UPDATE
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
```

- [ ] **Step 2: Apply migration + verify**

```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/2026_04_21_02_organization_profiles.sql
```

Verify:

```sql
SELECT count(*) FROM organization_profiles;  -- 0
\d organization_profiles
```

Expected: table exists, RLS on, three policies listed.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/2026_04_21_02_organization_profiles.sql
git commit -m "feat(db): add organization_profiles table with RLS"
```

---

### Task 1.3: TypeScript types for orgs + enums

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Add types**

Append to `types/index.ts`:

```ts
export type ProfileType = 'user' | 'vet' | 'clinic' | 'fundacion'
export type ProfileRole = 'user' | 'admin'
export type AlertCategory = 'lost' | 'injury' | 'abuse' | 'abandonment' | 'emergency' | 'catastrophe'
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
```

(Confirm the existing `Profile` type has `role`, `verified`, `country`, `region`, `city_slug`. Add them if missing — same file.)

- [ ] **Step 2: Commit**

```bash
git add types/index.ts
git commit -m "feat(types): add org, enum, and geo types"
```

---

### Task 1.4: Geo slug helper

**Files:**
- Create: `lib/geoSlug.ts`

- [ ] **Step 1: Write helper**

```ts
// lib/geoSlug.ts
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export interface ParsedCity { city_slug: string; region?: string; country?: string }

export function parseCityInput(city: string, region?: string, country?: string): ParsedCity {
  return { city_slug: slugify(city), region, country: country?.toUpperCase() }
}
```

- [ ] **Step 2: Quick eyeball check**

No runner. Inspect by mental test: `slugify('Viña del Mar')` → `vina-del-mar`. `slugify('São Paulo')` → `sao-paulo`.

- [ ] **Step 3: Commit**

```bash
git add lib/geoSlug.ts
git commit -m "feat(lib): add geoSlug helper"
```

---

### Task 1.5: Extend type-picker with "Fundación" option

**Files:**
- Modify: `app/(auth)/type-picker.tsx` (open first to confirm existing structure)

- [ ] **Step 1: Add card**

Inside the existing list of type cards, add a new entry mirroring the vet/clinic cards:

```tsx
{
  value: 'fundacion',
  title: t('auth.typePicker.fundacion.title'),
  subtitle: t('auth.typePicker.fundacion.subtitle'),
  icon: '🏛️',
}
```

Route selection: when `fundacion` picked, navigate to `/(auth)/onboarding/fundacion` after credentials step, same pattern vet/clinic use today.

- [ ] **Step 2: Add i18n strings**

`locales/es.json`:

```json
"auth": {
  "typePicker": {
    "fundacion": {
      "title": "Fundación / ONG",
      "subtitle": "Soy una organización que ayuda a animales"
    }
  }
}
```

`locales/en.json` mirror with English.

- [ ] **Step 3: Manual verify**

Run `yarn start`, open app, register → type picker. New card shows, tapping leads to credentials → fundacion onboarding (stub next task).

- [ ] **Step 4: Commit**

```bash
git add app/(auth)/type-picker.tsx locales/es.json locales/en.json
git commit -m "feat(auth): add fundacion option to type picker"
```

---

### Task 1.6: Fundacion onboarding screen

**Files:**
- Create: `app/(auth)/onboarding/fundacion.tsx`

- [ ] **Step 1: Write screen**

```tsx
// app/(auth)/onboarding/fundacion.tsx
import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { usePhotoUpload } from '@/lib/usePhotoUpload'
import { useLocation } from '@/lib/useLocation'
import { slugify } from '@/lib/geoSlug'
import { useAuthStore } from '@/store/authStore'
import { Colors } from '@/constants/colors'

export default function FundacionOnboarding() {
  const { t } = useTranslation()
  const { session, fetchProfile } = useAuthStore()
  const { pickAndUpload, uploading } = usePhotoUpload()
  const { pick: pickLocation } = useLocation()
  const [orgName, setOrgName] = useState('')
  const [description, setDescription] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [region, setRegion] = useState('')
  const [country, setCountry] = useState('CL')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleLogo() {
    const url = await pickAndUpload('org-logos')
    if (url) setLogoUrl(url)
  }

  async function handleGps() {
    const loc = await pickLocation()
    if (loc) { setGps({ lat: loc.lat, lng: loc.lng }); if (!address) setAddress(loc.address) }
  }

  async function handleSave() {
    if (!orgName.trim()) return Alert.alert(t('common.error'), t('fundacion.onboarding.errNoName'))
    if (!city.trim()) return Alert.alert(t('common.error'), t('fundacion.onboarding.errNoCity'))
    setSaving(true)
    try {
      const city_slug = slugify(city)
      const { data: prof } = await supabase.from('profiles').select('id').eq('user_id', session!.user.id).single()
      if (!prof) throw new Error('profile missing')

      const { error: up } = await supabase.from('profiles').update({
        type: 'fundacion', country, region, city_slug,
      }).eq('id', prof.id)
      if (up) throw up

      const { error: insErr } = await supabase.from('organization_profiles').insert({
        profile_id: prof.id,
        org_name: orgName, logo_url: logoUrl, description,
        contact_email: email || null, contact_phone: phone || null, website: website || null,
        address: address || null, gps,
      })
      if (insErr) throw insErr

      await fetchProfile()
      router.replace('/(tabs)')
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message)
    } finally { setSaving(false) }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: '700' }}>{t('fundacion.onboarding.title')}</Text>

        <TouchableOpacity onPress={handleLogo} style={{ padding: 12, backgroundColor: Colors.card, borderRadius: 8 }}>
          <Text>{logoUrl ? t('fundacion.onboarding.logoChange') : t('fundacion.onboarding.logoPick')}</Text>
        </TouchableOpacity>

        <TextInput placeholder={t('fundacion.onboarding.name')} value={orgName} onChangeText={setOrgName} style={inputStyle} />
        <TextInput placeholder={t('fundacion.onboarding.description')} value={description} onChangeText={setDescription} multiline style={[inputStyle, { minHeight: 80 }]} />
        <TextInput placeholder={t('fundacion.onboarding.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" style={inputStyle} />
        <TextInput placeholder={t('fundacion.onboarding.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={inputStyle} />
        <TextInput placeholder={t('fundacion.onboarding.website')} value={website} onChangeText={setWebsite} autoCapitalize="none" style={inputStyle} />
        <TextInput placeholder={t('fundacion.onboarding.address')} value={address} onChangeText={setAddress} style={inputStyle} />

        <TouchableOpacity onPress={handleGps} style={{ padding: 12, backgroundColor: Colors.card, borderRadius: 8 }}>
          <Text>{gps ? `📍 ${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}` : t('fundacion.onboarding.gpsPick')}</Text>
        </TouchableOpacity>

        <TextInput placeholder={t('fundacion.onboarding.city')} value={city} onChangeText={setCity} style={inputStyle} />
        <TextInput placeholder={t('fundacion.onboarding.region')} value={region} onChangeText={setRegion} style={inputStyle} />
        <TextInput placeholder={t('fundacion.onboarding.country')} value={country} onChangeText={(v) => setCountry(v.toUpperCase())} maxLength={2} style={inputStyle} />

        <TouchableOpacity onPress={handleSave} disabled={saving || uploading} style={{ padding: 16, backgroundColor: Colors.primary, borderRadius: 8, alignItems: 'center' }}>
          <Text style={{ color: 'white', fontWeight: '700' }}>{saving ? '...' : t('common.save')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const inputStyle = { padding: 12, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#ddd' } as const
```

- [ ] **Step 2: Add i18n strings**

`locales/es.json` under `fundacion.onboarding`:

```json
"fundacion": {
  "onboarding": {
    "title": "Datos de tu fundación",
    "logoPick": "Elegir logo",
    "logoChange": "Cambiar logo",
    "name": "Nombre de la organización",
    "description": "Descripción",
    "email": "Email de contacto",
    "phone": "Teléfono",
    "website": "Sitio web",
    "address": "Dirección",
    "gpsPick": "Marcar ubicación en mapa",
    "city": "Ciudad",
    "region": "Región / Provincia",
    "country": "País (código ISO, ej: CL)",
    "errNoName": "Ingresa el nombre de la organización",
    "errNoCity": "Ingresa la ciudad"
  }
}
```

Mirror in `locales/en.json`.

- [ ] **Step 3: Manual smoke**

Register as a new user → pick Fundación → credentials → onboarding → fill → save → lands on tabs. Verify in Supabase: `profiles.type='fundacion'`, `organization_profiles` row exists.

- [ ] **Step 4: Commit**

```bash
git add app/(auth)/onboarding/fundacion.tsx locales/es.json locales/en.json
git commit -m "feat(auth): fundacion onboarding screen"
```

---

### Task 1.7: authStore loads organization_profile

**Files:**
- Modify: `store/authStore.ts`

- [ ] **Step 1: Extend store state**

Open `store/authStore.ts`. Next to existing `vetProfile` / `clinicProfile`, add:

```ts
organizationProfile: OrganizationProfile | null
```

In the `fetchProfile` action, after loading `profile`, add:

```ts
if (profile?.type === 'fundacion') {
  const { data: org } = await supabase
    .from('organization_profiles')
    .select('*')
    .eq('profile_id', profile.id)
    .single()
  set({ organizationProfile: org ?? null })
} else {
  set({ organizationProfile: null })
}
```

Import `OrganizationProfile` from `@/types`.

- [ ] **Step 2: Manual smoke**

Log in as the fundacion user created in 1.6. In a screen, read `useAuthStore(s => s.organizationProfile)` — verify populated.

- [ ] **Step 3: Commit**

```bash
git add store/authStore.ts
git commit -m "feat(store): load organization_profile for fundacion users"
```

---

## Phase 2 — Directory segment for ONGs

### Task 2.1: Add "ONGs" segment to search tab

**Files:**
- Modify: `app/(tabs)/search.tsx`

- [ ] **Step 1: Extend Tab type + filters UI**

Change:

```ts
type Tab = 'vets' | 'clinics' | 'orgs'
```

Add a 3rd button in the segmented control matching the existing two.

- [ ] **Step 2: Add fetchOrgs**

```ts
async function fetchOrgs(search: string): Promise<OrgWithProfile[]> {
  let query = supabase
    .from('organization_profiles')
    .select('*, profile:profiles(*)')
    .order('created_at', { ascending: false })
  if (search) query = query.ilike('org_name', `%${search}%`)
  const { data } = await query.limit(30)
  return (data ?? []) as OrgWithProfile[]
}
```

Import `OrgWithProfile` from `@/types`.

- [ ] **Step 3: Render org list when tab = 'orgs'**

Add a branch that renders a simple card (logo, name, verified badge if `profile.verified`, city). On tap → `router.push('/orgs/' + item.profile_id)`.

Example card:

```tsx
<TouchableOpacity onPress={() => router.push(`/orgs/${item.profile_id}`)} style={cardStyle}>
  {item.logo_url ? <Image source={{ uri: item.logo_url }} style={{ width: 48, height: 48, borderRadius: 24 }} /> : <Text>🏛️</Text>}
  <View style={{ flex: 1 }}>
    <Text style={{ fontWeight: '700' }}>{item.org_name}{item.profile.verified ? ' ✓' : ''}</Text>
    <Text style={{ color: Colors.muted }}>{item.profile.city_slug ?? ''}</Text>
  </View>
</TouchableOpacity>
```

- [ ] **Step 4: i18n labels**

`locales/es.json` under existing directory keys: `"orgs": "ONGs"`. Same in en.json.

- [ ] **Step 5: Manual smoke**

Open tab, switch to ONGs — list shows the test fundacion from 1.6. Search filters name.

- [ ] **Step 6: Commit**

```bash
git add app/(tabs)/search.tsx locales/es.json locales/en.json
git commit -m "feat(directory): add ONGs segment to directory tab"
```

---

### Task 2.2: Org profile page

**Files:**
- Create: `app/orgs/[id].tsx`

- [ ] **Step 1: Write screen**

```tsx
// app/orgs/[id].tsx
import { View, Text, ScrollView, Image, TouchableOpacity, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { Colors } from '@/constants/colors'
import type { OrgWithProfile, AdoptionPost, FundraisingCampaign } from '@/types'

export default function OrgDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { t } = useTranslation()

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
  })

  const { data: campaigns } = useQuery({
    queryKey: ['org-campaigns', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('fundraising_campaigns')
        .select('*')
        .eq('creator_id', id)
        .order('created_at', { ascending: false })
        .limit(10)
      return (data ?? []) as FundraisingCampaign[]
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
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {org.logo_url && <Image source={{ uri: org.logo_url }} style={{ width: 96, height: 96, borderRadius: 48, alignSelf: 'center' }} />}
        <Text style={{ fontSize: 22, fontWeight: '700', textAlign: 'center' }}>
          {org.org_name}{org.profile.verified ? ' ✓' : ''}
        </Text>
        {org.description && <Text>{org.description}</Text>}

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {org.contact_email && <TouchableOpacity onPress={() => Linking.openURL(`mailto:${org.contact_email}`)} style={btn}><Text>✉️</Text></TouchableOpacity>}
          {org.contact_phone && <TouchableOpacity onPress={() => Linking.openURL(`tel:${org.contact_phone}`)} style={btn}><Text>📞</Text></TouchableOpacity>}
          {org.website && <TouchableOpacity onPress={() => Linking.openURL(org.website!)} style={btn}><Text>🌐</Text></TouchableOpacity>}
        </View>

        <Text style={section}>{t('org.campaigns')}</Text>
        {(campaigns ?? []).map(c => (
          <TouchableOpacity key={c.id} onPress={() => router.push(`/fundraising/${c.id}`)} style={rowStyle}>
            <Text>{c.title}</Text>
          </TouchableOpacity>
        ))}

        <Text style={section}>{t('org.adoptions')}</Text>
        {(adoptions ?? []).map(a => (
          <TouchableOpacity key={a.id} onPress={() => router.push(`/adoption/${a.id}`)} style={rowStyle}>
            <Text>{a.name} — {a.species}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const btn = { padding: 12, backgroundColor: Colors.card, borderRadius: 8 } as const
const rowStyle = { padding: 12, backgroundColor: Colors.card, borderRadius: 8 } as const
const section = { fontSize: 18, fontWeight: '600', marginTop: 12 } as const
```

- [ ] **Step 2: i18n strings**

`locales/es.json`:
```json
"org": { "campaigns": "Campañas activas", "adoptions": "En adopción" }
```

Mirror in en.json.

- [ ] **Step 3: Manual smoke**

From directory ONGs → tap org card → profile opens, shows logo/name/desc/contact buttons. Campaigns and adoption sections empty if none yet — that's fine.

- [ ] **Step 4: Commit**

```bash
git add app/orgs/[id].tsx locales/es.json locales/en.json
git commit -m "feat(orgs): org detail page"
```

---

## Phase 3 — Alerts: catastrophe + geo fanout + emergency broadcasts

### Task 3.1: Migration — alerts geo + catastrophe

**Files:**
- Create: `supabase/migrations/2026_04_21_03_alerts_catastrophe.sql`

- [ ] **Step 1: Write migration**

```sql
-- 2026_04_21_03_alerts_catastrophe.sql
ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS city_slug TEXT,
  ADD COLUMN IF NOT EXISTS catastrophe_subtype TEXT
    CHECK (catastrophe_subtype IN ('earthquake','flood','fire','other'));

ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_category_check;
ALTER TABLE alerts ADD CONSTRAINT alerts_category_check
  CHECK (category IN ('injured','abandoned','abuse','stray','emergency','other','catastrophe'));

CREATE INDEX IF NOT EXISTS idx_alerts_country_city ON alerts(country, city_slug);

-- Fanout function: notify orgs in same city; widen to country on severity=5 OR catastrophe
CREATE OR REPLACE FUNCTION fn_alert_fanout() RETURNS TRIGGER AS $$
DECLARE
  target_profile UUID;
  is_wide BOOLEAN := (NEW.severity = 5 OR NEW.category = 'catastrophe');
BEGIN
  IF NEW.country IS NULL THEN RETURN NEW; END IF;

  FOR target_profile IN
    SELECT p.id FROM profiles p
    WHERE p.type = 'fundacion'
      AND p.country = NEW.country
      AND (is_wide OR p.city_slug = NEW.city_slug)
  LOOP
    INSERT INTO notifications (profile_id, type, title, body, data)
    VALUES (
      target_profile, 'alert',
      COALESCE(NEW.title, 'Nueva alerta'),
      COALESCE(NEW.description, ''),
      jsonb_build_object('alert_id', NEW.id, 'wide', is_wide, 'severity', NEW.severity)
    );
  END LOOP;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_alert_fanout ON alerts;
CREATE TRIGGER trg_alert_fanout AFTER INSERT ON alerts
  FOR EACH ROW EXECUTE FUNCTION fn_alert_fanout();
```

- [ ] **Step 2: Apply + verify**

```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/2026_04_21_03_alerts_catastrophe.sql
```

SQL smoke:

```sql
-- Seed 2 orgs in Santiago + 1 in Valparaíso
-- Seed an alert in Santiago, severity=3 → only Santiago orgs get notifications
-- Seed an alert severity=5 in Santiago → both Santiago AND Valparaíso orgs (same country=CL) get notifications
```

Count `notifications` rows before/after each insert.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/2026_04_21_03_alerts_catastrophe.sql
git commit -m "feat(db): alerts catastrophe category + geo fanout trigger"
```

---

### Task 3.2: Migration — emergency_broadcasts

**Files:**
- Create: `supabase/migrations/2026_04_21_04_emergency_broadcasts.sql`

- [ ] **Step 1: Write migration**

```sql
-- 2026_04_21_04_emergency_broadcasts.sql
CREATE TABLE IF NOT EXISTS emergency_broadcasts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  scope         TEXT NOT NULL CHECK (scope IN ('city','region','country')),
  country       TEXT,
  region        TEXT,
  city_slug     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_emergency_country ON emergency_broadcasts(country);

ALTER TABLE emergency_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eb_public_read" ON emergency_broadcasts FOR SELECT USING (true);

CREATE POLICY "eb_admin_or_verified_org_insert" ON emergency_broadcasts FOR INSERT
  WITH CHECK (
    creator_id IN (
      SELECT id FROM profiles
      WHERE user_id = auth.uid()
        AND (role = 'admin' OR (type = 'fundacion' AND verified = TRUE))
    )
  );

-- Fan-out on broadcast insert: all profiles matching scope
CREATE OR REPLACE FUNCTION fn_broadcast_fanout() RETURNS TRIGGER AS $$
DECLARE
  target_profile UUID;
BEGIN
  FOR target_profile IN
    SELECT p.id FROM profiles p
    WHERE
      (NEW.scope = 'country' AND p.country = NEW.country)
      OR (NEW.scope = 'region' AND p.country = NEW.country AND p.region = NEW.region)
      OR (NEW.scope = 'city' AND p.country = NEW.country AND p.city_slug = NEW.city_slug)
  LOOP
    INSERT INTO notifications (profile_id, type, title, body, data)
    VALUES (target_profile, 'broadcast', NEW.title, NEW.body,
            jsonb_build_object('broadcast_id', NEW.id, 'scope', NEW.scope));
  END LOOP;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_broadcast_fanout ON emergency_broadcasts;
CREATE TRIGGER trg_broadcast_fanout AFTER INSERT ON emergency_broadcasts
  FOR EACH ROW EXECUTE FUNCTION fn_broadcast_fanout();
```

- [ ] **Step 2: Apply + verify RLS**

```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/2026_04_21_04_emergency_broadcasts.sql
```

SQL: log in as a plain user → INSERT should fail. Log in as admin (`UPDATE profiles SET role='admin' WHERE id=...`) → INSERT succeeds, all profiles in scope receive `notifications` row.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/2026_04_21_04_emergency_broadcasts.sql
git commit -m "feat(db): emergency_broadcasts table + fanout"
```

---

### Task 3.3: Alerts — catastrophe category in UI

**Files:**
- Modify: `app/alerts/new.tsx`

- [ ] **Step 1: Extend category list**

Find the existing `CATEGORIES` constant (or equivalent). Add:

```ts
{ value: 'catastrophe', label: t('alerts.categories.catastrophe'), icon: '🌋' }
```

- [ ] **Step 2: Conditional subtype picker**

When `category === 'catastrophe'`, render a subtype segmented control:

```tsx
{category === 'catastrophe' && (
  <View style={{ flexDirection: 'row', gap: 8 }}>
    {(['earthquake','flood','fire','other'] as const).map(s => (
      <TouchableOpacity key={s} onPress={() => setSubtype(s)} style={[chip, subtype===s && chipActive]}>
        <Text>{t(`alerts.catastrophe.${s}`)}</Text>
      </TouchableOpacity>
    ))}
  </View>
)}
```

- [ ] **Step 3: Include geo + subtype on insert**

Use authStore's profile country/region/city_slug:

```ts
const { profile } = useAuthStore.getState()
await supabase.from('alerts').insert({
  /* existing fields */,
  category,
  catastrophe_subtype: category === 'catastrophe' ? subtype : null,
  country: profile?.country ?? null,
  city_slug: profile?.city_slug ?? null,
})
```

- [ ] **Step 4: i18n strings**

```json
"alerts": {
  "categories": { "catastrophe": "Catástrofe" },
  "catastrophe": { "earthquake": "Terremoto", "flood": "Inundación", "fire": "Incendio", "other": "Otro" }
}
```

- [ ] **Step 5: Manual smoke**

Create alert with category=catastrophe subtype=earthquake from a Santiago user. Open Supabase → verify row inserted + notifications rows for all CL orgs (not only Santiago).

- [ ] **Step 6: Commit**

```bash
git add app/alerts/new.tsx locales/es.json locales/en.json
git commit -m "feat(alerts): catastrophe category + country-wide fanout"
```

---

### Task 3.4: Admin layout gate

**Files:**
- Create: `app/admin/_layout.tsx`

- [ ] **Step 1: Write gate**

```tsx
// app/admin/_layout.tsx
import { Stack, Redirect } from 'expo-router'
import { useAuthStore } from '@/store/authStore'

export default function AdminLayout() {
  const profile = useAuthStore(s => s.profile)
  if (!profile || profile.role !== 'admin') return <Redirect href="/(tabs)" />
  return <Stack />
}
```

- [ ] **Step 2: Commit**

```bash
git add app/admin/_layout.tsx
git commit -m "feat(admin): route gate requires role=admin"
```

---

### Task 3.5: Admin emergency broadcast screen

**Files:**
- Create: `app/admin/broadcasts.tsx`

- [ ] **Step 1: Write screen**

```tsx
// app/admin/broadcasts.tsx
import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { slugify } from '@/lib/geoSlug'
import { Colors } from '@/constants/colors'
import type { BroadcastScope } from '@/types'

export default function AdminBroadcasts() {
  const { t } = useTranslation()
  const profile = useAuthStore(s => s.profile)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [scope, setScope] = useState<BroadcastScope>('country')
  const [country, setCountry] = useState(profile?.country ?? 'CL')
  const [region, setRegion] = useState('')
  const [city, setCity] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSend() {
    if (!title.trim() || !body.trim()) return Alert.alert(t('common.error'), t('admin.broadcast.required'))
    setSaving(true)
    const { error } = await supabase.from('emergency_broadcasts').insert({
      creator_id: profile!.id,
      title, body, scope,
      country: country.toUpperCase(),
      region: scope === 'city' || scope === 'region' ? region : null,
      city_slug: scope === 'city' ? slugify(city) : null,
    })
    setSaving(false)
    if (error) return Alert.alert(t('common.error'), error.message)
    Alert.alert(t('admin.broadcast.sent'))
    router.back()
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: '700' }}>{t('admin.broadcast.title')}</Text>
        <TextInput placeholder={t('admin.broadcast.titleField')} value={title} onChangeText={setTitle} style={inputStyle} />
        <TextInput placeholder={t('admin.broadcast.body')} value={body} onChangeText={setBody} multiline style={[inputStyle, { minHeight: 100 }]} />

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['city','region','country'] as BroadcastScope[]).map(s => (
            <TouchableOpacity key={s} onPress={() => setScope(s)} style={[chip, scope===s && chipActive]}>
              <Text>{t(`admin.broadcast.scope.${s}`)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput placeholder="Country (CL, AR, ...)" value={country} onChangeText={(v) => setCountry(v.toUpperCase())} maxLength={2} style={inputStyle} />
        {(scope === 'region' || scope === 'city') && (
          <TextInput placeholder={t('admin.broadcast.region')} value={region} onChangeText={setRegion} style={inputStyle} />
        )}
        {scope === 'city' && (
          <TextInput placeholder={t('admin.broadcast.city')} value={city} onChangeText={setCity} style={inputStyle} />
        )}

        <TouchableOpacity onPress={handleSend} disabled={saving} style={{ padding: 16, backgroundColor: Colors.danger, borderRadius: 8, alignItems: 'center' }}>
          <Text style={{ color: 'white', fontWeight: '700' }}>{saving ? '...' : t('admin.broadcast.send')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const inputStyle = { padding: 12, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#ddd' } as const
const chip = { padding: 10, borderRadius: 8, backgroundColor: Colors.card } as const
const chipActive = { backgroundColor: Colors.primary } as const
```

- [ ] **Step 2: i18n strings**

```json
"admin": {
  "broadcast": {
    "title": "Alerta masiva",
    "titleField": "Título",
    "body": "Mensaje",
    "scope": { "city": "Ciudad", "region": "Región", "country": "País" },
    "region": "Región", "city": "Ciudad",
    "send": "Enviar",
    "sent": "Enviada",
    "required": "Título y mensaje requeridos"
  }
}
```

- [ ] **Step 3: Manual smoke**

Promote a test account to admin in SQL. Open `/admin/broadcasts` — form loads. Send country-scope CL broadcast. Verify `emergency_broadcasts` row + matching `notifications` rows for all CL profiles. Non-admin → route redirects to tabs.

- [ ] **Step 4: Commit**

```bash
git add app/admin/broadcasts.tsx locales/es.json locales/en.json
git commit -m "feat(admin): emergency broadcast composer"
```

---

## Phase 4 — Adoption catalog extensions

### Task 4.1: Migration — sex + health_status on adoption_posts

**Files:**
- Create: `supabase/migrations/2026_04_21_05_adoption_extensions.sql`

- [ ] **Step 1: Write migration**

```sql
-- 2026_04_21_05_adoption_extensions.sql
ALTER TABLE adoption_posts
  ADD COLUMN IF NOT EXISTS sex TEXT CHECK (sex IN ('male','female','unknown')) DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS health_status TEXT CHECK (health_status IN ('healthy','treatment','chronic','special_needs')) DEFAULT 'healthy';
```

- [ ] **Step 2: Apply + commit**

```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/2026_04_21_05_adoption_extensions.sql
git add supabase/migrations/2026_04_21_05_adoption_extensions.sql
git commit -m "feat(db): adoption_posts sex + health_status"
```

---

### Task 4.2: adoption/new.tsx form updates

**Files:**
- Modify: `app/adoption/new.tsx`

- [ ] **Step 1: Add state + fields**

```tsx
const [sex, setSex] = useState<AdoptionSex>('unknown')
const [health, setHealth] = useState<AdoptionHealth>('healthy')
```

UI — two segmented controls:

```tsx
<Text>{t('adoption.form.sex')}</Text>
<View style={row}>
  {(['male','female','unknown'] as AdoptionSex[]).map(s => (
    <TouchableOpacity key={s} onPress={() => setSex(s)} style={[chip, sex===s && chipActive]}><Text>{t(`adoption.form.sexVal.${s}`)}</Text></TouchableOpacity>
  ))}
</View>

<Text>{t('adoption.form.health')}</Text>
<View style={row}>
  {(['healthy','treatment','chronic','special_needs'] as AdoptionHealth[]).map(h => (
    <TouchableOpacity key={h} onPress={() => setHealth(h)} style={[chip, health===h && chipActive]}><Text>{t(`adoption.form.healthVal.${h}`)}</Text></TouchableOpacity>
  ))}
</View>
```

- [ ] **Step 2: Pass to insert**

```ts
await supabase.from('adoption_posts').insert({
  /* existing fields */,
  sex,
  health_status: health,
})
```

- [ ] **Step 3: i18n strings**

```json
"adoption": {
  "form": {
    "sex": "Sexo", "health": "Salud",
    "sexVal": { "male": "Macho", "female": "Hembra", "unknown": "Desconocido" },
    "healthVal": { "healthy": "Sano", "treatment": "En tratamiento", "chronic": "Condición crónica", "special_needs": "Necesidades especiales" }
  }
}
```

- [ ] **Step 4: Manual smoke + commit**

Create adoption post → row contains sex + health_status.

```bash
git add app/adoption/new.tsx locales/es.json locales/en.json
git commit -m "feat(adoption): sex + health_status fields on new post"
```

---

### Task 4.3: Adoption detail shows new fields + poster badge

**Files:**
- Modify: `app/adoption/[id].tsx`, `app/(tabs)/adopt.tsx`

- [ ] **Step 1: Detail page shows sex/health + org badge**

In `[id].tsx`, render the new fields near existing pet metadata. If poster is a fundacion (`profile.type==='fundacion'`), show `🏛️ {org_name}` badge pulled from `organization_profiles`.

Query change:

```ts
.select('*, poster:profiles(*, organization_profiles(*))')
```

- [ ] **Step 2: Catalog card adds badge**

In `adopt.tsx` list renderer, if `item.poster?.type === 'fundacion'`, show a small 🏛️ badge.

- [ ] **Step 3: Manual smoke + commit**

Post as fundacion → card + detail show badge + new fields.

```bash
git add app/adoption/[id].tsx app/(tabs)/adopt.tsx
git commit -m "feat(adoption): show sex/health + org badge"
```

---

## Phase 5 — Applications + contracts + monitoring

### Task 5.1: Migration — adoption_applications

**Files:**
- Create: `supabase/migrations/2026_04_21_06_adoption_applications.sql`

- [ ] **Step 1: Write migration**

```sql
-- 2026_04_21_06_adoption_applications.sql
CREATE TABLE IF NOT EXISTS adoption_applications (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id        UUID NOT NULL REFERENCES adoption_posts(id) ON DELETE CASCADE,
  applicant_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message        TEXT,
  contact_phone  TEXT,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','withdrawn')),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  decided_at     TIMESTAMPTZ
);

CREATE INDEX idx_adoption_apps_post ON adoption_applications(post_id);
CREATE INDEX idx_adoption_apps_applicant ON adoption_applications(applicant_id);

ALTER TABLE adoption_applications ENABLE ROW LEVEL SECURITY;

-- Applicant reads own; post owner reads all apps on their post
CREATE POLICY "apps_read" ON adoption_applications FOR SELECT USING (
  applicant_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR post_id IN (
    SELECT ap.id FROM adoption_posts ap
    WHERE ap.poster_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
);

-- Applicant inserts own; post must still be available
CREATE POLICY "apps_insert" ON adoption_applications FOR INSERT WITH CHECK (
  applicant_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  AND EXISTS (SELECT 1 FROM adoption_posts WHERE id = post_id AND status = 'available')
);

-- Applicant can withdraw
CREATE POLICY "apps_withdraw" ON adoption_applications FOR UPDATE USING (
  applicant_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
) WITH CHECK (status = 'withdrawn');
```

- [ ] **Step 2: Apply + commit**

```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/2026_04_21_06_adoption_applications.sql
git add supabase/migrations/2026_04_21_06_adoption_applications.sql
git commit -m "feat(db): adoption_applications table + RLS"
```

---

### Task 5.2: Migration — contracts + monitoring_sessions + approval RPC

**Files:**
- Create: `supabase/migrations/2026_04_21_07_contracts_and_monitoring.sql`

- [ ] **Step 1: Write migration**

```sql
-- 2026_04_21_07_contracts_and_monitoring.sql
CREATE TABLE IF NOT EXISTS adoption_contracts (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id   UUID NOT NULL UNIQUE REFERENCES adoption_applications(id) ON DELETE CASCADE,
  post_id          UUID NOT NULL REFERENCES adoption_posts(id) ON DELETE CASCADE,
  adopter_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  poster_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  org_id           UUID REFERENCES organization_profiles(id) ON DELETE SET NULL,
  signed_at        TIMESTAMPTZ DEFAULT NOW(),
  monitoring_until TIMESTAMPTZ NOT NULL,
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled'))
);

CREATE TABLE IF NOT EXISTS monitoring_sessions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id    UUID NOT NULL REFERENCES adoption_contracts(id) ON DELETE CASCADE,
  scheduled_at   TIMESTAMPTZ NOT NULL,
  type           TEXT NOT NULL CHECK (type IN ('photo','video')),
  status         TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','missed')),
  photo_urls     TEXT[] DEFAULT '{}',
  notes          TEXT,
  jitsi_room     TEXT,
  verifier_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  verified_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_monitoring_contract ON monitoring_sessions(contract_id);
CREATE INDEX idx_monitoring_scheduled ON monitoring_sessions(scheduled_at) WHERE status = 'scheduled';

ALTER TABLE adoption_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contracts_parties_read" ON adoption_contracts FOR SELECT USING (
  adopter_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR poster_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

CREATE POLICY "sessions_parties_read" ON monitoring_sessions FOR SELECT USING (
  contract_id IN (
    SELECT id FROM adoption_contracts
    WHERE adopter_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
       OR poster_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
);

-- Adopter uploads photos/notes
CREATE POLICY "sessions_adopter_update" ON monitoring_sessions FOR UPDATE USING (
  contract_id IN (
    SELECT id FROM adoption_contracts
    WHERE adopter_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
);

-- Approval RPC
CREATE OR REPLACE FUNCTION fn_approve_application(app_id UUID) RETURNS UUID AS $$
DECLARE
  app adoption_applications%ROWTYPE;
  post adoption_posts%ROWTYPE;
  contract_id UUID;
  org_profile_id UUID;
BEGIN
  SELECT * INTO app FROM adoption_applications WHERE id = app_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'application not found'; END IF;
  IF app.status <> 'pending' THEN RAISE EXCEPTION 'not pending'; END IF;

  SELECT * INTO post FROM adoption_posts WHERE id = app.post_id;
  IF post.status <> 'available' THEN RAISE EXCEPTION 'post not available'; END IF;

  -- Caller must be the post owner
  IF post.poster_id NOT IN (SELECT id FROM profiles WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  -- Resolve org id if poster is a fundacion
  SELECT op.id INTO org_profile_id FROM organization_profiles op
    WHERE op.profile_id = post.poster_id;

  UPDATE adoption_applications SET status='approved', decided_at=NOW() WHERE id=app_id;

  INSERT INTO adoption_contracts (application_id, post_id, adopter_id, poster_id, org_id, monitoring_until)
  VALUES (app_id, app.post_id, app.applicant_id, post.poster_id, org_profile_id, NOW() + INTERVAL '1 year')
  RETURNING id INTO contract_id;

  INSERT INTO monitoring_sessions (contract_id, scheduled_at, type) VALUES
    (contract_id, NOW() + INTERVAL '1 month',  'photo'),
    (contract_id, NOW() + INTERVAL '3 months', 'video'),
    (contract_id, NOW() + INTERVAL '6 months', 'photo'),
    (contract_id, NOW() + INTERVAL '12 months','video');

  UPDATE adoption_posts SET status='adopted' WHERE id = app.post_id;

  UPDATE adoption_applications
    SET status='rejected', decided_at=NOW()
    WHERE post_id = app.post_id AND id <> app_id AND status='pending';

  RETURN contract_id;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verifier completes session
CREATE OR REPLACE FUNCTION fn_verify_session(session_id UUID, note TEXT DEFAULT NULL) RETURNS VOID AS $$
DECLARE
  s monitoring_sessions%ROWTYPE;
  c adoption_contracts%ROWTYPE;
  caller_profile UUID;
BEGIN
  SELECT * INTO s FROM monitoring_sessions WHERE id = session_id FOR UPDATE;
  SELECT * INTO c FROM adoption_contracts WHERE id = s.contract_id;

  SELECT id INTO caller_profile FROM profiles WHERE user_id = auth.uid() LIMIT 1;
  IF caller_profile IS NULL OR caller_profile <> c.poster_id THEN
    RAISE EXCEPTION 'only poster can verify';
  END IF;

  UPDATE monitoring_sessions
    SET status='completed', verifier_id=caller_profile, verified_at=NOW(), notes=COALESCE(note, notes)
    WHERE id = session_id;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
```

- [ ] **Step 2: Apply + SQL assertions**

```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/2026_04_21_07_contracts_and_monitoring.sql
```

Smoke: create application → call `SELECT fn_approve_application('<app_id>')` → verify contract + 4 sessions + post adopted + sibling apps rejected.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/2026_04_21_07_contracts_and_monitoring.sql
git commit -m "feat(db): adoption contracts, monitoring_sessions, approval + verify RPCs"
```

---

### Task 5.3: Application screen

**Files:**
- Create: `app/adoption/apply/[postId].tsx`

- [ ] **Step 1: Write screen**

```tsx
// app/adoption/apply/[postId].tsx
import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Colors } from '@/constants/colors'

export default function ApplyScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>()
  const { t } = useTranslation()
  const profile = useAuthStore(s => s.profile)
  const [message, setMessage] = useState('')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    setSaving(true)
    const { error } = await supabase.from('adoption_applications').insert({
      post_id: postId,
      applicant_id: profile!.id,
      message,
      contact_phone: phone,
    })
    setSaving(false)
    if (error) return Alert.alert(t('common.error'), error.message)
    Alert.alert(t('adoption.apply.sent'))
    router.back()
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <View style={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: '700' }}>{t('adoption.apply.title')}</Text>
        <TextInput multiline placeholder={t('adoption.apply.message')} value={message} onChangeText={setMessage}
          style={{ padding: 12, backgroundColor: '#fff', borderRadius: 8, minHeight: 120, borderWidth: 1, borderColor: '#ddd' }} />
        <TextInput placeholder={t('adoption.apply.phone')} value={phone} onChangeText={setPhone}
          keyboardType="phone-pad"
          style={{ padding: 12, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#ddd' }} />
        <TouchableOpacity onPress={handleSubmit} disabled={saving}
          style={{ padding: 16, backgroundColor: Colors.primary, borderRadius: 8, alignItems: 'center' }}>
          <Text style={{ color: 'white', fontWeight: '700' }}>{saving ? '...' : t('adoption.apply.send')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}
```

- [ ] **Step 2: i18n strings**

```json
"adoption": {
  "apply": { "title": "Solicitar adopción", "message": "Cuéntanos sobre ti", "phone": "Teléfono", "send": "Enviar solicitud", "sent": "Solicitud enviada" }
}
```

- [ ] **Step 3: Hook up button in adoption/[id].tsx**

Add "Solicitar" button (visible when viewer !== poster and post.status === 'available'):

```tsx
<TouchableOpacity onPress={() => router.push(`/adoption/apply/${post.id}`)} style={primaryBtn}>
  <Text>{t('adoption.detail.applyCta')}</Text>
</TouchableOpacity>
```

- [ ] **Step 4: Manual smoke + commit**

Apply → Supabase row appears. RLS: user tries to apply to adopted post → fail.

```bash
git add app/adoption/apply/[postId].tsx app/adoption/[id].tsx locales/es.json locales/en.json
git commit -m "feat(adoption): application flow"
```

---

### Task 5.4: Poster sees applications list + approve

**Files:**
- Modify: `app/adoption/[id].tsx`

- [ ] **Step 1: Add query for apps on own post**

```tsx
const { data: apps } = useQuery({
  queryKey: ['apps', id],
  queryFn: async () => {
    const { data } = await supabase
      .from('adoption_applications')
      .select('*, applicant:profiles(*)')
      .eq('post_id', id)
      .order('created_at', { ascending: false })
    return data ?? []
  },
  enabled: isOwner,
})
```

- [ ] **Step 2: Render list w/ approve button**

```tsx
{isOwner && (apps ?? []).map(a => (
  <View key={a.id} style={rowStyle}>
    <Text style={{ fontWeight: '600' }}>{a.applicant.name}</Text>
    <Text>{a.message}</Text>
    <Text style={{ color: Colors.muted }}>{a.status}</Text>
    {a.status === 'pending' && (
      <TouchableOpacity onPress={() => approve(a.id)} style={approveBtn}>
        <Text style={{ color: 'white' }}>{t('adoption.apply.approve')}</Text>
      </TouchableOpacity>
    )}
  </View>
))}
```

Approve calls the RPC:

```ts
async function approve(appId: string) {
  const { error } = await supabase.rpc('fn_approve_application', { app_id: appId })
  if (error) return Alert.alert(t('common.error'), error.message)
  queryClient.invalidateQueries({ queryKey: ['apps', id] })
  queryClient.invalidateQueries({ queryKey: ['adoption', id] })
}
```

- [ ] **Step 3: Manual smoke + commit**

Apply as user A. Log in as poster. See list. Approve → post flips to `adopted`, sibling apps (if any) rejected, contract created.

```bash
git add app/adoption/[id].tsx locales/es.json locales/en.json
git commit -m "feat(adoption): applications list + approval on poster view"
```

---

### Task 5.5: My applications screen

**Files:**
- Create: `app/profile/my-applications.tsx`

- [ ] **Step 1: Write screen**

Shows two sections: "Solicitudes" (apps by me) and "Contratos activos" (contracts where I'm adopter). Taps navigate to adoption detail / contract page.

```tsx
// app/profile/my-applications.tsx
import { View, Text, FlatList, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Colors } from '@/constants/colors'

export default function MyApplications() {
  const { t } = useTranslation()
  const profile = useAuthStore(s => s.profile)

  const { data: apps } = useQuery({
    queryKey: ['my-apps', profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('adoption_applications')
        .select('*, post:adoption_posts(*)')
        .eq('applicant_id', profile!.id)
        .order('created_at', { ascending: false })
      return data ?? []
    },
    enabled: !!profile,
  })

  const { data: contracts } = useQuery({
    queryKey: ['my-contracts', profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('adoption_contracts')
        .select('*, post:adoption_posts(*)')
        .eq('adopter_id', profile!.id)
        .order('signed_at', { ascending: false })
      return data ?? []
    },
    enabled: !!profile,
  })

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <View style={{ padding: 16, gap: 12 }}>
        <Text style={section}>{t('profile.myApps.applications')}</Text>
        {(apps ?? []).map(a => (
          <TouchableOpacity key={a.id} onPress={() => router.push(`/adoption/${a.post_id}`)} style={rowStyle}>
            <Text>{a.post?.name} — {a.status}</Text>
          </TouchableOpacity>
        ))}

        <Text style={section}>{t('profile.myApps.contracts')}</Text>
        {(contracts ?? []).map(c => (
          <TouchableOpacity key={c.id} onPress={() => router.push(`/adoption/contract/${c.id}`)} style={rowStyle}>
            <Text>{c.post?.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  )
}

const section = { fontSize: 18, fontWeight: '600' } as const
const rowStyle = { padding: 12, backgroundColor: Colors.card, borderRadius: 8 } as const
```

- [ ] **Step 2: Link from profile tab**

In `app/(tabs)/profile.tsx`, add menu item → `/profile/my-applications`.

- [ ] **Step 3: Commit**

```bash
git add app/profile/my-applications.tsx app/(tabs)/profile.tsx locales/es.json locales/en.json
git commit -m "feat(profile): my applications + contracts list"
```

---

### Task 5.6: Contract summary screen

**Files:**
- Create: `app/adoption/contract/[contractId].tsx`

- [ ] **Step 1: Write screen**

```tsx
// app/adoption/contract/[contractId].tsx
import { View, Text, FlatList, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { Colors } from '@/constants/colors'

export default function ContractScreen() {
  const { contractId } = useLocalSearchParams<{ contractId: string }>()
  const { t } = useTranslation()

  const { data: contract } = useQuery({
    queryKey: ['contract', contractId],
    queryFn: async () => {
      const { data } = await supabase
        .from('adoption_contracts')
        .select('*, post:adoption_posts(*), adopter:profiles!adopter_id(*), poster:profiles!poster_id(*)')
        .eq('id', contractId)
        .single()
      return data
    },
  })

  const { data: sessions } = useQuery({
    queryKey: ['sessions', contractId],
    queryFn: async () => {
      const { data } = await supabase
        .from('monitoring_sessions')
        .select('*')
        .eq('contract_id', contractId)
        .order('scheduled_at', { ascending: true })
      return data ?? []
    },
  })

  if (!contract) return null
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <View style={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: '700' }}>{contract.post?.name}</Text>
        <Text>{t('contract.signed')}: {new Date(contract.signed_at).toLocaleDateString()}</Text>
        <Text>{t('contract.until')}: {new Date(contract.monitoring_until).toLocaleDateString()}</Text>
        <Text>{t('contract.status')}: {contract.status}</Text>

        <Text style={section}>{t('contract.sessions')}</Text>
        {(sessions ?? []).map(s => (
          <TouchableOpacity key={s.id} onPress={() => router.push(`/monitoring/${s.id}`)} style={rowStyle}>
            <Text>{new Date(s.scheduled_at).toLocaleDateString()} — {s.type} — {s.status}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  )
}

const section = { fontSize: 18, fontWeight: '600' } as const
const rowStyle = { padding: 12, backgroundColor: Colors.card, borderRadius: 8 } as const
```

- [ ] **Step 2: Commit**

```bash
git add app/adoption/contract/[contractId].tsx locales/es.json locales/en.json
git commit -m "feat(adoption): contract summary screen"
```

---

## Phase 6 — Monitoring sessions + Jitsi + cron

### Task 6.1: Jitsi room helper

**Files:**
- Create: `lib/jitsiRoom.ts`

- [ ] **Step 1: Write helper**

```ts
// lib/jitsiRoom.ts
export function buildRoomUrl(contractId: string, sessionId: string): string {
  return `https://meet.jit.si/huellitas-${contractId.slice(0, 8)}-${sessionId.slice(0, 8)}`
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/jitsiRoom.ts
git commit -m "feat(lib): jitsi room url builder"
```

---

### Task 6.2: Install react-native-webview

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

```bash
yarn add react-native-webview
```

- [ ] **Step 2: Rebuild EAS dev client**

```bash
eas build --profile development --platform android --local
```

(Or push to EAS cloud build if local disabled.)

- [ ] **Step 3: Commit**

```bash
git add package.json yarn.lock
git commit -m "chore: add react-native-webview"
```

---

### Task 6.3: Monitoring session screen

**Files:**
- Create: `app/monitoring/[sessionId].tsx`

- [ ] **Step 1: Write screen**

```tsx
// app/monitoring/[sessionId].tsx
import { useState } from 'react'
import { View, Text, TouchableOpacity, Linking, Alert, Image, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { usePhotoUpload } from '@/lib/usePhotoUpload'
import { buildRoomUrl } from '@/lib/jitsiRoom'
import { useAuthStore } from '@/store/authStore'
import { Colors } from '@/constants/colors'

export default function SessionScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const { t } = useTranslation()
  const profile = useAuthStore(s => s.profile)
  const qc = useQueryClient()
  const { pickAndUpload, uploading } = usePhotoUpload()
  const [note, setNote] = useState('')

  const { data } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: async () => {
      const { data } = await supabase
        .from('monitoring_sessions')
        .select('*, contract:adoption_contracts(*)')
        .eq('id', sessionId)
        .single()
      return data
    },
  })

  if (!data) return null
  const isAdopter = data.contract.adopter_id === profile?.id
  const isPoster = data.contract.poster_id === profile?.id
  const roomUrl = buildRoomUrl(data.contract_id, data.id)

  async function addPhoto() {
    const url = await pickAndUpload('monitoring')
    if (!url) return
    const next = [...(data!.photo_urls ?? []), url]
    await supabase.from('monitoring_sessions').update({ photo_urls: next }).eq('id', sessionId)
    qc.invalidateQueries({ queryKey: ['session', sessionId] })
  }

  async function markVerified() {
    const { error } = await supabase.rpc('fn_verify_session', { session_id: sessionId, note: note || null })
    if (error) return Alert.alert(t('common.error'), error.message)
    qc.invalidateQueries({ queryKey: ['session', sessionId] })
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 20, fontWeight: '700' }}>
          {t('monitoring.session')}: {new Date(data.scheduled_at).toLocaleDateString()}
        </Text>
        <Text>{t('monitoring.type')}: {data.type}</Text>
        <Text>{t('monitoring.status')}: {data.status}</Text>

        {data.type === 'photo' && isAdopter && data.status === 'scheduled' && (
          <TouchableOpacity onPress={addPhoto} disabled={uploading} style={primary}>
            <Text style={{ color: 'white' }}>{t('monitoring.addPhoto')}</Text>
          </TouchableOpacity>
        )}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(data.photo_urls ?? []).map(url => (
            <Image key={url} source={{ uri: url }} style={{ width: 96, height: 96, borderRadius: 8 }} />
          ))}
        </View>

        {data.type === 'video' && data.status === 'scheduled' && (
          <TouchableOpacity onPress={() => Linking.openURL(roomUrl)} style={primary}>
            <Text style={{ color: 'white' }}>{t('monitoring.joinCall')}</Text>
          </TouchableOpacity>
        )}

        {isPoster && data.status === 'scheduled' && (
          <TouchableOpacity onPress={markVerified} style={[primary, { backgroundColor: Colors.success }]}>
            <Text style={{ color: 'white' }}>{t('monitoring.markVerified')}</Text>
          </TouchableOpacity>
        )}

        {data.notes && <Text>{t('monitoring.notes')}: {data.notes}</Text>}
      </ScrollView>
    </SafeAreaView>
  )
}

const primary = { padding: 16, backgroundColor: Colors.primary, borderRadius: 8, alignItems: 'center' } as const
```

- [ ] **Step 2: i18n strings**

```json
"monitoring": {
  "session": "Sesión",
  "type": "Tipo",
  "status": "Estado",
  "addPhoto": "Subir foto",
  "joinCall": "Unirse a videollamada",
  "markVerified": "Marcar verificada",
  "notes": "Notas"
}
```

- [ ] **Step 3: Manual smoke + commit**

Adopter uploads photos → list updates. Poster marks verified → status=completed, photos/notes visible, verify button hides.

Video session: adopter taps "Unirse" → Jitsi opens in browser. Poster (on another device) also opens URL → same room. Poster taps "Marcar verificada" after call.

```bash
git add app/monitoring/[sessionId].tsx locales/es.json locales/en.json
git commit -m "feat(monitoring): session screen w/ photo + jitsi"
```

---

### Task 6.4: Cron for reminders + missed marking

**Files:**
- Create: `supabase/migrations/2026_04_21_09_cron_monitoring.sql`

- [ ] **Step 1: Write migration**

```sql
-- 2026_04_21_09_cron_monitoring.sql
-- Requires pg_cron extension (enable via Supabase dashboard: Database → Extensions → pg_cron)

CREATE OR REPLACE FUNCTION fn_monitoring_daily() RETURNS VOID AS $$
BEGIN
  -- Reminders: sessions scheduled in next 2 days, not yet reminded
  INSERT INTO notifications (profile_id, type, title, body, data)
  SELECT c.adopter_id, 'monitoring_reminder',
         'Check-in próximo',
         'Tu sesión de seguimiento está próxima',
         jsonb_build_object('session_id', s.id, 'scheduled_at', s.scheduled_at)
  FROM monitoring_sessions s
  JOIN adoption_contracts c ON c.id = s.contract_id
  WHERE s.status = 'scheduled'
    AND s.scheduled_at BETWEEN NOW() AND NOW() + INTERVAL '2 days'
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.profile_id = c.adopter_id
        AND n.type = 'monitoring_reminder'
        AND n.data->>'session_id' = s.id::text
    );

  -- Mark missed: scheduled sessions >3 days past due
  UPDATE monitoring_sessions
    SET status = 'missed'
    WHERE status = 'scheduled' AND scheduled_at < NOW() - INTERVAL '3 days';
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT cron.schedule('monitoring_daily', '0 9 * * *', $$ SELECT fn_monitoring_daily(); $$);
```

- [ ] **Step 2: Enable pg_cron extension first**

Supabase dashboard → Database → Extensions → search `pg_cron` → Enable. Then apply migration.

- [ ] **Step 3: Verify**

```sql
SELECT * FROM cron.job WHERE jobname = 'monitoring_daily';
SELECT fn_monitoring_daily();   -- manual run, inspect notifications
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/2026_04_21_09_cron_monitoring.sql
git commit -m "feat(cron): daily monitoring reminders + missed marking"
```

---

## Phase 7 — Verification + campaign extras

### Task 7.1: Migration — campaign extras

**Files:**
- Create: `supabase/migrations/2026_04_21_08_campaign_extras.sql`

- [ ] **Step 1: Write migration**

```sql
-- 2026_04_21_08_campaign_extras.sql
ALTER TABLE fundraising_campaigns
  ADD COLUMN IF NOT EXISTS updates JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS receipts TEXT[] DEFAULT '{}';

-- Add RPC for appending update (enforces verified-org check)
CREATE OR REPLACE FUNCTION fn_campaign_add_update(campaign_id UUID, update_payload JSONB) RETURNS VOID AS $$
DECLARE
  caller UUID;
BEGIN
  SELECT p.id INTO caller FROM profiles p
    WHERE p.user_id = auth.uid()
      AND p.type = 'fundacion'
      AND p.verified = TRUE
    LIMIT 1;
  IF caller IS NULL THEN RAISE EXCEPTION 'only verified orgs can update campaigns'; END IF;

  UPDATE fundraising_campaigns
    SET updates = updates || update_payload
    WHERE id = campaign_id AND creator_id = caller;
  IF NOT FOUND THEN RAISE EXCEPTION 'not your campaign'; END IF;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
```

- [ ] **Step 2: Apply + commit**

```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/2026_04_21_08_campaign_extras.sql
git add supabase/migrations/2026_04_21_08_campaign_extras.sql
git commit -m "feat(db): campaign updates/receipts + RPC"
```

---

### Task 7.2: Campaign detail — show + add updates for verified orgs

**Files:**
- Modify: `app/fundraising/[id].tsx`

- [ ] **Step 1: Fetch includes updates/receipts**

Already `SELECT *` — no query change needed.

- [ ] **Step 2: Render updates timeline**

Below the existing donation list:

```tsx
{(campaign.updates ?? []).map((u: any, i: number) => (
  <View key={i} style={rowStyle}>
    <Text style={{ fontWeight: '600' }}>{new Date(u.date).toLocaleDateString()}</Text>
    <Text>{u.text}</Text>
  </View>
))}
```

- [ ] **Step 3: "Add update" button for verified-org creator**

```tsx
const profile = useAuthStore(s => s.profile)
const isOrgOwner = profile?.type === 'fundacion' && profile?.verified && campaign.creator_id === profile.id
```

```tsx
{isOrgOwner && (
  <TouchableOpacity onPress={addUpdate} style={primary}>
    <Text style={{ color: 'white' }}>{t('fundraising.addUpdate')}</Text>
  </TouchableOpacity>
)}
```

Handler prompts for text and calls RPC:

```ts
async function addUpdate() {
  // prompt via Alert.prompt on iOS, or push to a small modal on Android — simple: navigate to /fundraising/update/{id}
  // For MVP, inline via Alert.prompt (iOS only). Android: quick modal.
  const text = await quickPrompt(t('fundraising.updatePrompt'))
  if (!text) return
  const { error } = await supabase.rpc('fn_campaign_add_update', {
    campaign_id: campaign.id,
    update_payload: { date: new Date().toISOString(), text },
  })
  if (error) return Alert.alert(t('common.error'), error.message)
  qc.invalidateQueries({ queryKey: ['campaign', id] })
}
```

Replace `quickPrompt` with existing pattern in app or a simple TextInput modal.

- [ ] **Step 4: Commit**

```bash
git add app/fundraising/[id].tsx locales/es.json locales/en.json
git commit -m "feat(fundraising): campaign updates timeline + add-update for verified orgs"
```

---

### Task 7.3: Admin verify orgs screen

**Files:**
- Create: `app/admin/verify.tsx`

- [ ] **Step 1: Write screen**

```tsx
// app/admin/verify.tsx
import { View, Text, FlatList, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { Colors } from '@/constants/colors'

export default function AdminVerify() {
  const { t } = useTranslation()
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: ['unverified-orgs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('organization_profiles')
        .select('*, profile:profiles(*)')
        .eq('profile.verified', false)
        .eq('profile.type', 'fundacion')
      return data ?? []
    },
  })

  async function verify(profileId: string) {
    const { error } = await supabase.from('profiles').update({ verified: true }).eq('id', profileId)
    if (error) return
    qc.invalidateQueries({ queryKey: ['unverified-orgs'] })
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <FlatList
        data={data ?? []}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => (
          <View style={{ padding: 12, backgroundColor: Colors.card, borderRadius: 8, gap: 4 }}>
            <Text style={{ fontWeight: '700' }}>{item.org_name}</Text>
            <Text>{item.description}</Text>
            <Text style={{ color: Colors.muted }}>{item.contact_email}</Text>
            <TouchableOpacity onPress={() => verify(item.profile_id)}
              style={{ padding: 10, backgroundColor: Colors.success, borderRadius: 6, alignSelf: 'flex-start' }}>
              <Text style={{ color: 'white' }}>{t('admin.verify.approve')}</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/admin/verify.tsx locales/es.json locales/en.json
git commit -m "feat(admin): org verification queue"
```

---

## Phase 8 — Wrap-up

### Task 8.1: Update schema.sql pointer comment

**Files:**
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Add header note**

At top of file:

```sql
-- NOTE: Fundaciones/ONGs module extensions live in supabase/migrations/2026_04_21_*.sql
-- Apply in order. Do not duplicate those definitions here.
```

- [ ] **Step 2: Commit**

```bash
git add supabase/schema.sql
git commit -m "docs(db): point to fundaciones migrations"
```

---

### Task 8.2: End-to-end smoke on preview build

- [ ] **Step 1: Build**

```bash
eas build --profile preview --platform android --clear-cache
```

- [ ] **Step 2: Scenario pass**

1. Register as fundacion → onboarding → verify in Supabase.
2. Admin promotes (SQL) → verifies org via `/admin/verify`.
3. Org creates adoption post (with sex + health_status).
4. Second user applies → org approves from detail page → contract + 4 sessions visible in adopter's "Mis solicitudes".
5. Photo session: adopter uploads photos → org marks verified.
6. Video session: both open Jitsi URL → call connects → org marks verified.
7. Severity-5 alert in Santiago → fundacion in Valparaíso (same country CL) receives push.
8. Admin fires country-scope emergency broadcast → all CL profiles get push.
9. Verified org adds campaign update → timeline shows entry.

- [ ] **Step 3: Commit remaining + push**

If any fixes from smoke, commit per fix. Then:

```bash
git push origin dev
```

---

## Self-review

**Spec coverage:** every section of the design has at least one task. Geo model → 1.1 + 1.4. Fundacion onboarding → 1.2 + 1.6. Directory segment → 2.1 + 2.2. Alert fanout + catastrophe → 3.1 + 3.3. Emergency broadcasts + admin → 3.2 + 3.4 + 3.5. Adoption field extensions → 4.1 + 4.2 + 4.3. Applications + contracts + monitoring → 5.1 + 5.2 + 5.3 + 5.4 + 5.5 + 5.6 + 6.1 + 6.2 + 6.3. Cron → 6.4. Campaign extras + verify → 7.1 + 7.2 + 7.3.

**Placeholder scan:** no TBD/TODO. `quickPrompt` called out as placeholder to replace with existing modal pattern — intentional since the existing pattern wasn't inspected; flagged in Task 7.2 Step 3.

**Type consistency:** `fn_approve_application(app_id UUID)`, `fn_verify_session(session_id UUID, note TEXT)`, `fn_campaign_add_update(campaign_id UUID, update_payload JSONB)` — all referenced consistently across SQL and client code.

**Known gap:** the exact shape of the pre-existing `Profile`, `AdoptionPost`, `FundraisingCampaign` types is assumed. Task 1.3 includes a confirm step, and the executor should adjust imports/props if existing shapes differ.
