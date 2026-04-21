# Fundaciones / ONGs Module — Design

Date: 2026-04-20
Status: Draft for review
Author: Claude + FrancoFM93

## Goal

Add NGO/foundation ("fundación") as a first-class profile type in Huellitas. Fundaciones receive alerts relevant to animals in need, run fundraising campaigns with richer transparency, post pets for adoption, and act as verifiers in a 1-year post-adoption monitoring flow. Add a catastrophe/emergency broadcast mechanism for wide-area events (earthquake, flood, fire, etc.) — scales from Chile to worldwide deployments.

## Non-goals

- Google / social login (deferred, separate spec).
- Payment processing for donations (reuse whatever fundraising already does).
- Built-in video-call recording or auth (Jitsi public rooms for MVP; can swap to Daily.co later).
- Live geofencing / moving radius. City + country match only.

## Decisions (answered during brainstorming)

- **Profile type:** `fundacion` is a full profile type (like `vet`, `clinic`). Own signup and onboarding.
- **Onboarding fields:** minimal — org name, logo, description, contact (email/phone/web), address, GPS.
- **Alert delivery:** A+B combo → all alerts in same city auto-push to orgs in that city; severity=5 OR `catastrophe` category broadcasts country-wide; admins can fire `emergency_broadcasts` scoped city/region/country to all users and orgs.
- **Campaigns:** reuse existing `fundraising_campaigns` table and flow; verified orgs unlock extra optional fields (`updates`, `receipts`).
- **Verification:** tiered. Self-declared orgs sign up with `verified=false`. Admin flips the flag. Verified badge unlocks mass broadcasts, campaign extras, and higher adoption-post quotas.
- **Adoption:** single shared catalog. Org authorship shown via badge on card. Adoption posts gain `sex` and `health_status` fields.
- **Adoption contract:** 1-year post-adoption monitoring. Scheduled sessions at month 1, 3, 6, 12. Each session is either photo upload or video call. Jitsi Meet public room URL is deterministic per session (no backend signaling). Verifier (org rep or poster) marks session completed.
- **Directory:** extend existing `search` tab into "Directorio" with three segments: Veterinarios | Clínicas | ONGs. No new tab slot added.

## Geo model

All geo-targeted features (alert fanout, emergency broadcasts, directory search) use a three-level hierarchy:

- `country` — ISO 3166-1 alpha-2 code (e.g. `CL`, `AR`, `US`).
- `region` — first-level subdivision (state/province/region). Free text per country (e.g. `Metropolitana`, `Valparaíso`).
- `city_slug` — lowercase ASCII slug of city name (e.g. `santiago`, `vina-del-mar`). Computed client-side via `slugify(city).toLowerCase()` on profile creation / alert creation.

Stored as plain columns on `profiles`, `alerts`, `emergency_broadcasts`. No separate geography tables for MVP.

## Data model

### New tables

```sql
-- Org profile extension (parallels vet_profiles, clinic_profiles)
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
  gps            JSONB,   -- { lat, lng }
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Admin / verified-org mass broadcasts
CREATE TABLE IF NOT EXISTS emergency_broadcasts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  body           TEXT NOT NULL,
  scope          TEXT NOT NULL CHECK (scope IN ('city','region','country')),
  country        TEXT,
  region         TEXT,
  city_slug      TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Adopter applies to an adoption post
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

-- Signed adoption deal. One per approved application.
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

-- Scheduled monitoring check-ins, generated on contract creation
CREATE TABLE IF NOT EXISTS monitoring_sessions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id    UUID NOT NULL REFERENCES adoption_contracts(id) ON DELETE CASCADE,
  scheduled_at   TIMESTAMPTZ NOT NULL,
  type           TEXT NOT NULL CHECK (type IN ('photo','video')),
  status         TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','missed')),
  photo_urls     TEXT[] DEFAULT '{}',
  notes          TEXT,
  jitsi_room     TEXT,  -- deterministic: huellitas-<contract_id>-<session_id>
  verifier_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  verified_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_monitoring_sessions_contract ON monitoring_sessions(contract_id);
CREATE INDEX idx_monitoring_sessions_scheduled ON monitoring_sessions(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX idx_adoption_apps_post ON adoption_applications(post_id);
CREATE INDEX idx_adoption_apps_applicant ON adoption_applications(applicant_id);
CREATE INDEX idx_emergency_country ON emergency_broadcasts(country);
CREATE INDEX idx_org_profiles_profile ON organization_profiles(profile_id);
```

### Altered tables

```sql
-- profiles: admin role, verification, geo for targeting
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS city_slug TEXT;

-- profile type enum must allow 'fundacion'. Existing check constraint needs rewrite.
-- (drop-and-recreate in migration)

-- alerts: catastrophe category + geo for fanout
ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS catastrophe_subtype TEXT CHECK (catastrophe_subtype IN ('earthquake','flood','fire','other')),
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS city_slug TEXT;
-- expand category CHECK to include 'catastrophe'

-- adoption_posts: sex + health_status
ALTER TABLE adoption_posts
  ADD COLUMN IF NOT EXISTS sex TEXT CHECK (sex IN ('male','female','unknown')) DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS health_status TEXT CHECK (health_status IN ('healthy','treatment','chronic','special_needs')) DEFAULT 'healthy';

-- fundraising_campaigns: org extras
ALTER TABLE fundraising_campaigns
  ADD COLUMN IF NOT EXISTS updates JSONB DEFAULT '[]'::jsonb,  -- [{date, text, photos[]}]
  ADD COLUMN IF NOT EXISTS receipts TEXT[] DEFAULT '{}';
-- RLS: only verified orgs can UPDATE updates/receipts columns (enforced in policy or via RPC)
```

### Triggers / functions

```sql
-- Fan-out on alert insert: city default, country if severity=5 or catastrophe
CREATE OR REPLACE FUNCTION fn_alert_fanout() RETURNS TRIGGER AS $$
DECLARE
  target_profile UUID;
  is_wide BOOLEAN := (NEW.severity = 5 OR NEW.category = 'catastrophe');
BEGIN
  FOR target_profile IN
    SELECT p.id FROM profiles p
    WHERE p.type = 'fundacion'
      AND p.country = NEW.country
      AND (is_wide OR p.city_slug = NEW.city_slug)
  LOOP
    INSERT INTO notifications (profile_id, type, title, body, data)
    VALUES (target_profile, 'alert', NEW.title, NEW.description,
            jsonb_build_object('alert_id', NEW.id, 'wide', is_wide));
  END LOOP;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_alert_fanout AFTER INSERT ON alerts
  FOR EACH ROW EXECUTE FUNCTION fn_alert_fanout();

-- On application approve: create contract + 4 sessions, set post status
CREATE OR REPLACE FUNCTION fn_approve_application(app_id UUID) RETURNS UUID AS $$
DECLARE
  app adoption_applications%ROWTYPE;
  post adoption_posts%ROWTYPE;
  contract_id UUID;
BEGIN
  SELECT * INTO app FROM adoption_applications WHERE id = app_id FOR UPDATE;
  IF app.status <> 'pending' THEN RAISE EXCEPTION 'not pending'; END IF;
  SELECT * INTO post FROM adoption_posts WHERE id = app.post_id;

  UPDATE adoption_applications SET status='approved', decided_at=NOW() WHERE id=app_id;

  INSERT INTO adoption_contracts (application_id, post_id, adopter_id, poster_id, monitoring_until)
  VALUES (app_id, app.post_id, app.applicant_id, post.poster_id, NOW() + INTERVAL '1 year')
  RETURNING id INTO contract_id;

  INSERT INTO monitoring_sessions (contract_id, scheduled_at, type) VALUES
    (contract_id, NOW() + INTERVAL '1 month',  'photo'),
    (contract_id, NOW() + INTERVAL '3 months', 'video'),
    (contract_id, NOW() + INTERVAL '6 months', 'photo'),
    (contract_id, NOW() + INTERVAL '12 months','video');

  UPDATE adoption_posts SET status='adopted' WHERE id = app.post_id;

  -- Auto-reject other pending applications on same post
  UPDATE adoption_applications
    SET status='rejected', decided_at=NOW()
    WHERE post_id = app.post_id AND id <> app_id AND status='pending';

  RETURN contract_id;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
```

### RLS notes

- `organization_profiles`: public read; own-row update via profile link; insert restricted to authenticated users creating their own.
- `emergency_broadcasts`: public read; insert only if `profiles.role='admin'` OR (`profiles.type='fundacion' AND profiles.verified=true`).
- `adoption_applications`: applicant reads own; post owner reads applications to their post; applicant inserts own; only post owner updates status (via `fn_approve_application` RPC).
- `adoption_contracts`: adopter + poster + org read; no direct insert (RPC only); no direct update except `fn_complete_contract`.
- `monitoring_sessions`: contract parties read; adopter updates own `photo_urls`/`notes`; verifier updates `status='completed'`, `verifier_id`, `verified_at`.

## Screens + routes

New or extended. Scaled to complexity.

- `app/(auth)/type-picker` — extend: add "Fundación" card.
- `app/(auth)/onboarding/fundacion.tsx` — form: org_name, logo upload (reuse `usePhotoUpload`), description, contact_email/phone/website, address, GPS picker (reuse `useLocation`).
- `app/(tabs)/search.tsx` → rename internally to "Directorio". Segmented control with 3 tabs: `vets` | `clinics` | `orgs`. Add `fetchOrgs(search)`.
- `app/orgs/[id].tsx` — org profile page. Shows logo, description, verified badge, contact buttons, tabs: Campañas | Adopciones | Alertas creadas.
- `app/adoption/new.tsx` — extend: add `sex` segmented control, `health_status` dropdown.
- `app/adoption/apply/[postId].tsx` — new: message + phone, submit creates `adoption_applications` row.
- `app/adoption/[id].tsx` — extend: if viewer = poster, show applications list inline with approve/reject buttons.
- `app/adoption/contract/[contractId].tsx` — shows adopter, pet, signed date, monitoring schedule, list of sessions with status.
- `app/monitoring/[sessionId].tsx` — adopter view: upload photos OR "Unirse a llamada" (opens Jitsi URL in WebView or `Linking.openURL`). Verifier view: same + "Marcar verificada" button.
- `app/(tabs)/alerts/new.tsx` — extend: `catastrophe` category + subtype picker.
- `app/fundraising/new.tsx` + `[id].tsx` — extend: if creator verified org, show `updates` + `receipts` fields + "Agregar actualización" button.
- `app/admin/broadcasts.tsx` — admin-only: compose emergency broadcast (title/body/scope/geo).
- `app/admin/verify.tsx` — admin-only: list of unverified orgs, approve/reject.
- `app/profile/my-applications.tsx` — adopter sees own applications + active contracts.
- `app/profile/my-posts.tsx` — poster sees own adoption posts + applications received (may already exist — verify).

## Data flow summary

1. Fundacion signup → `profiles` (type=fundacion, verified=false) + `organization_profiles` row.
2. Alert INSERT → `fn_alert_fanout` → `notifications` → existing `send-push` Edge Function → Expo push.
3. Emergency broadcast INSERT → similar fanout but targets users + orgs by scope.
4. User applies → `adoption_applications` INSERT.
5. Poster approves → `fn_approve_application` RPC → `adoption_contracts` + 4 `monitoring_sessions` + post.status=adopted.
6. Supabase pg_cron daily job: push reminders for sessions in next 2 days, mark missed sessions (>3 days past scheduled).
7. Session check-in: adopter uploads photos OR joins Jitsi room `https://meet.jit.si/huellitas-<contract_id>-<session_id>`. Verifier marks completed.
8. Admin verifies org → `profiles.verified=true`. Unlocks broadcast + campaign extras + adoption quota.

## Error handling + edge cases

- **Alert with missing country/city_slug:** fanout skipped; fall back to existing `location` text-match only for same-user-created alerts. Do not push orgs.
- **Application submitted to adopted post:** RLS INSERT policy on `adoption_applications` includes `EXISTS (SELECT 1 FROM adoption_posts WHERE id = post_id AND status = 'available')`. No separate RPC needed for apply.
- **Multiple approvals on same post:** first approve flips status to `adopted`; subsequent approve calls raise; other pending apps auto-transition to `rejected` in the same RPC.
- **Missed session:** status=missed, adopter + verifier both notified. No auto-penalty — manual follow-up.
- **Contract cancellation:** either party can cancel within monitoring period. Status=cancelled, remaining scheduled sessions deleted.
- **Unverified org tries to broadcast / write campaign updates:** RLS denies. UI hides the button when `verified=false`.
- **Org deletes profile mid-contract:** `org_id` set null on contract; adopter + poster still bound. Contract continues.
- **Jitsi URL collision:** deterministic per session_id (UUID) — no collision risk.
- **i18n:** all new strings in `locales/es.json` + `locales/en.json`. Spanish default.

## Testing plan

- **Unit / RPC:** `fn_approve_application` — approves, creates contract + 4 sessions, sets post adopted, rejects other pending. `fn_alert_fanout` — city-only vs wide (severity 5 / catastrophe).
- **Integration:** fundacion signup → onboarding → verified toggle → unlocks broadcast button. Adoption apply → approve → contract appears in adopter's list.
- **E2E (manual):** full adoption lifecycle: browse → apply → approve → session 1 (photo) → session 2 (video via Jitsi) → verifier marks → contract completes after all sessions done.
- **Push:** simulate alert insert from city A; verify only orgs in city A receive push. Insert severity=5 alert; verify all orgs in country receive.
- **RLS:** non-admin cannot insert `emergency_broadcasts`. Unverified org cannot write campaign `updates`.

## Rollout

1. Write migration SQL, run on staging Supabase.
2. Seed a test admin account (`UPDATE profiles SET role='admin' WHERE id=...`).
3. Ship client changes behind no flag — new screens are additive, enum extensions accept but legacy clients ignore.
4. Deploy `send-push` Edge Function update if notification payload shape changed.
5. Manual smoke on preview EAS build before merge to `main`.
6. Post-rollout: document admin verification procedure for ops.

## Open items for implementation plan

- Decide cron mechanism: Supabase `pg_cron` vs external scheduled Edge Function. Recommend `pg_cron` (in-DB, simpler).
- Org focus_area field was floated but cut (minimal onboarding per decision). Can add later without migration cost if needed for directory search filters.
- Payment / donation split between org and platform: out of scope, reuse existing.
- Google login: deferred, separate spec.
