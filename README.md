# 🐾 Huellitas

A community mobile app for pet welfare. Find lost pets, report animals in danger, connect with vets, adopt, and raise emergency funds — all in one place.

Built with **React Native (Expo)** and **Supabase**.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo 55 + expo-router (file-based navigation) |
| Backend | Supabase (Postgres + Auth + Storage + Realtime) |
| Data fetching | TanStack React Query |
| Global state | Zustand |
| Maps | react-native-maps |
| Translations | i18next + react-i18next + expo-localization |
| Push notifications | expo-notifications + Supabase Edge Function |
| Camera / Gallery | expo-image-picker |
| GPS | expo-location |

---

## Prerequisites

- Node.js 18+
- Yarn
- Expo Go app on your phone (for testing), or a simulator
- A [Supabase](https://supabase.com) account (free tier is enough for everything)

---

## Setup

### 1. Install dependencies

```bash
yarn install
```

### 2. Environment variables

Copy `.env.example` to `.env` (or edit `.env` directly) and fill in your Supabase credentials:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Find these in your Supabase dashboard → **Project Settings → API**.

### 3. Supabase — run the SQL files

Go to your Supabase dashboard → **SQL Editor** and run these files **in order**:

| File | What it does | Run |
|------|-------------|-----|
| `supabase/schema.sql` | All tables, RLS policies, triggers, indexes | First time only |
| `supabase/storage.sql` | Creates the `photos` bucket for image uploads | First time only |
| `supabase/push_token_migration.sql` | Adds `push_token` column to `profiles` | First time only |

> If you already ran `schema.sql` before, just run `storage.sql` and `push_token_migration.sql`.

### 4. Run the app

```bash
yarn start
```

Scan the QR code with **Expo Go** on your phone, or press `i` for iOS simulator / `a` for Android.

---

## Project structure

```
huellitas/
├── app/                        # All screens (expo-router file-based)
│   ├── (auth)/                 # Auth flow: welcome, login, register, onboarding
│   ├── (tabs)/                 # Main tab bar: feed, map, search, fund, adopt, profile
│   ├── alerts/                 # New alert + alert detail
│   ├── adoption/               # New adoption post + adoption detail
│   ├── clinics/                # Clinic detail
│   ├── fundraising/            # New campaign + fundraiser detail
│   ├── missing/                # Missing pet detail + sighting report
│   ├── pets/                   # New pet + pet detail + pet edit
│   ├── profile/                # Profile edit
│   └── vets/                   # Vet detail
│
├── constants/
│   └── colors.ts               # Shared color palette
│
├── lib/
│   ├── supabase.ts             # Supabase client
│   ├── queryClient.ts          # React Query client
│   ├── i18n.ts                 # i18next setup (language detection + persistence)
│   ├── useLocation.ts          # Hook: GPS + reverse geocode → { lat, lng, address }
│   └── usePhotoUpload.ts       # Hook: pick image → upload to Supabase Storage → URL
│
├── locales/
│   ├── es.json                 # Spanish translations (default)
│   └── en.json                 # English translations
│
├── store/
│   ├── authStore.ts            # Auth state: session, profile, vet/clinic sub-profiles
│   └── notificationStore.ts   # Notifications list + Realtime subscription
│
├── supabase/
│   ├── schema.sql              # Full DB schema
│   ├── storage.sql             # Storage bucket setup
│   ├── push_token_migration.sql
│   └── functions/
│       └── send-push/
│           └── index.ts        # Edge Function: sends Expo push notifications
│
└── types/
    └── index.ts                # All TypeScript interfaces
```

---

## Features

### Auth
- Register as **owner/adopter**, **veterinarian**, or **clinic**
- Vets and clinics complete an onboarding step with professional details
- Session persists across app restarts

### Feed (home tab)
- Combined feed of community alerts and missing pet reports
- **Realtime** — new posts appear automatically without refresh
- Pull-to-refresh as fallback

### Map
- All active alerts and missing pets on an interactive map
- Filter by alerts / lost pets / all
- Tap a pin → callout → navigate to detail screen

### Alerts
- Report an animal in danger with category, urgency level (1–5), and location
- **GPS button** fills location automatically
- Severity ≥ 3 triggers automatic notifications to all vets/clinics
- Community members can respond to alerts

### Missing pets
- Mark your pet as lost → creates a community report
- Anyone can report a sighting with GPS location
- Pet owner is notified instantly when a sighting is reported
- Map shows last known location

### Vets & Clinics directory
- Search by name
- Vet detail: availability badge, specialties, fee, schedule, call/WhatsApp/email buttons
- Clinic detail: services, 24h emergency badge, "Get directions" to Google Maps
- **Vets can toggle their availability** from their profile — instantly visible to the community

### Adoption
- Post animals for adoption with health info, age range, and contact details
- Filter by species
- Owner can mark as Reserved or Adopted
- Contact buttons: WhatsApp, email

### Fundraising
- Create campaigns for people, animals, or the emergency fund
- Progress bar with real-time amounts
- Donation list with messages
- One-tap contribution to the shared emergency fund

### Profile
- Avatar photo upload
- Edit all profile fields (including vet/clinic sub-profiles)
- Notification inbox with unread counter
- **Language switcher** (Español / English) — persists across sessions

### Push notifications
- App registers your device token on login
- Notifications arrive even when the app is closed
- Tapping a notification deep-links to the relevant screen

---

## Key patterns

### Fetching data

All data fetching uses **React Query**. The pattern is consistent across every screen:

```ts
const { data, isLoading } = useQuery({
  queryKey: ['unique-key', id],
  queryFn: async () => {
    const { data } = await supabase.from('table').select('*').eq('id', id).single()
    return data
  },
})
```

After a mutation (insert/update), invalidate the relevant query to refresh:

```ts
queryClient.invalidateQueries({ queryKey: ['unique-key'] })
```

### Uploading photos

```ts
const { upload, uploading } = usePhotoUpload()
const url = await upload({ folder: 'avatars' }) // returns public URL or null
```

### GPS location

```ts
const { getLocation, locating } = useLocation()
const loc = await getLocation() // { lat, lng, address } or null
```

### Translations

Every screen uses the same two lines:

```ts
import { useTranslation } from 'react-i18next'
const { t } = useTranslation()

// Then in JSX:
<Text>{t('feed.empty_title')}</Text>
<Text>{t('pets.registered_msg', { name: pet.name })}</Text>
```

All keys are defined in `locales/es.json` and `locales/en.json`.

To add a new language, create `locales/xx.json`, add it to `lib/i18n.ts`, and add a button in the profile language picker.

### Realtime

The feed and notification store subscribe to Supabase Realtime channels. The pattern:

```ts
useEffect(() => {
  const channel = supabase
    .channel('my-channel')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'my_table' }, (payload) => {
      // handle new row
    })
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}, [])
```

---

## Push notifications setup

The app handles token registration automatically. To enable actual push delivery (when the app is closed):

**1. Deploy the Edge Function**

```bash
# Install Supabase CLI first: https://supabase.com/docs/guides/cli
supabase login
supabase link --project-ref your-project-ref
supabase functions deploy send-push
```

**2. Create a Database Webhook**

In the Supabase dashboard → **Database → Webhooks → Create new webhook**:

- Name: `send-push-on-notification`
- Table: `notifications`
- Event: `INSERT`
- URL: `https://your-project.supabase.co/functions/v1/send-push`
- HTTP method: `POST`

From this point, every notification inserted into the DB (by existing triggers) will automatically be pushed to the user's device.

> **Note:** Expo Go on SDK 53+ removed remote push notification support. Push token registration is automatically skipped when running in Expo Go — everything else works normally. To test actual push delivery, use a development build: `npx expo run:android` or `npx expo run:ios`.

---

## Supabase dashboard — managing your data

You don't need any special account in the app to manage data. The Supabase dashboard gives you full admin access:

- **Table Editor** — browse, edit, or delete any row
- **SQL Editor** — run any query directly
- **Storage** — manage uploaded photos
- **Authentication** — view registered users, ban, reset passwords
- **Logs** — see Edge Function logs and errors

The RLS (Row Level Security) policies only apply to requests made through the app with the anon key. Dashboard access bypasses them entirely.

---

## Adding new screens

1. Create the file under `app/` — expo-router picks it up automatically
2. Fetch data with `useQuery` + `supabase`
3. Add any new strings to both `locales/es.json` and `locales/en.json`
4. Use `useTranslation()` for all visible text

---

## Environment variables reference

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon (public) key |
