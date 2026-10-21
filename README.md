# Huellitas

A community mobile app for pet welfare, built with Expo/React Native and Supabase. The existing product includes pet profiles, lost-pet reports and sightings, community alerts, a professional/organization directory, adoption applications and follow-up, and owner/vet messaging.

**Development status:** recovery and stabilization, not ready for a public launch. The October 2026 audit resumes the work on `dev` (`b73a34e`, 17 commits ahead of the older `main`). See [the audit and release plan](docs/AUDIT_2026_10_21.md) for implemented features, confirmed defects, patch scope, and the remaining release criteria.

**Fundraising status:** campaigns can be created and browsed, but donations are unavailable. The app does not collect payments. The former client-side donation simulation and display of unverified raised totals have been removed; existing database records have not been deleted.

## Stack

| Area | Technology |
| --- | --- |
| Mobile app | Expo SDK 55, React Native 0.83, React 19.2, TypeScript |
| Navigation | Expo Router |
| Backend | Supabase Postgres, Auth, Storage, Realtime and Edge Functions |
| Client data | TanStack Query and Zustand |
| Localization | i18next, Spanish and English |
| Device features | Maps, image picker, location and Expo notifications |
| Regression checks | Node test runner, tsx and PGlite |

## Local setup

Use **Node.js 24** and **Yarn 1.22.22**. `.nvmrc` and `packageManager` record these choices. The test runner uses Node's `--test-isolation=none` option.

```bash
corepack yarn install --frozen-lockfile
```

Copy `.env.example` to `.env` and provide a Supabase project URL and **public** anon key:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
```

Never put service-role keys or webhook secrets in `EXPO_PUBLIC_*` variables; those values are bundled into the client. The app uses Supabase Storage, so no Cloudinary variables are required.

### Database: new staging project

The repository currently uses a base schema plus manually ordered SQL files. It is not yet a complete Supabase CLI migration project. Do not assume `supabase db push` alone reproduces it.

For a **new, empty staging project**, apply the following through the SQL Editor in order:

1. `supabase/schema.sql`
2. `supabase/storage.sql`
3. Every `.sql` file under `supabase/migrations/`, sorted by filename:

| Order | Migration suffix | Purpose |
| --- | --- | --- |
| 01 | `geo_and_roles` | Geography, foundation type, roles and verification |
| 02 | `organization_profiles` | Foundation profiles |
| 03 | `alerts_catastrophe` | Catastrophe alerts and geographic fanout |
| 04 | `emergency_broadcasts` | Scoped broadcasts |
| 05 | `adoption_extensions` | Adoption sex and health fields |
| 06 | `adoption_applications` | Applications |
| 07 | `contracts_and_monitoring` | Adoption approval and follow-up records |
| 08 | `adoption_notifications` | Notifications and missed-session routine |
| 09 | `push_tokens` | Existing profile token column |
| 10 | `account_deletion` | Deletion-request queue and anonymization |
| 11 | `vet_messages` | Owner/vet messaging |
| 12 | `security_baseline` | Restricted client writes and function privileges |
| 13 | `auth_profile_bootstrap` | Base profile creation and missing-profile backfill |

The first eleven filenames begin `2026_04_21_`; the recovery migrations are `2026_10_21_12_security_baseline.sql` and `2026_10_21_13_auth_profile_bootstrap.sql`. The old standalone `push_token_migration.sql` is superseded by migration 09 and is unnecessary for a new setup.

The base schema is not a safe script to rerun over an existing project: it creates named policies/triggers and initializes the emergency fund. For an **existing project**, first inspect its applied schema, policies/grants, custom Auth triggers and migration records, then apply only missing migrations. Preserve a database backup before rollout. Migration 13 uses a dedicated Auth trigger and does not overwrite existing profiles; inspect any previously hand-created signup trigger to avoid conflicting behavior.

The new SQL tests exercise the repository schema and policies with synthetic identities. They do not inspect or modify your hosted Supabase project. Public profile fields, private media storage, and complete account deactivation remain open release blockers described in the audit.

### Auth and Realtime configuration

Configure enabled login providers, email confirmation and allowed redirect URLs in the staging Supabase project. For installed builds, allow the app's callback URL, normally `huellitas://auth-callback`; development URLs depend on the chosen Expo environment. Google OAuth and email confirmation require real provider configuration and device verification.

Enable the needed tables in the Supabase Realtime publication for the subscribed features. The source subscribes to community alerts, missing reports, notifications and vet messages; inspect the channel declarations when configuring the project. SQL triggers create notification rows, but do not themselves enable Realtime or deliver a push.

### Run

```bash
corepack yarn start
```

Use a compatible Expo Go installation for supported basic flows, or a native development build. Remote notifications require an appropriate development/production build and FCM/APNs credentials. `eas.json` contains development/preview/production profiles, but those files alone do not establish that a build or its credentials is ready. iOS app identity and native map configuration still need review. Web support has not been established; the app includes native maps and the existing `web` script is not a verified web release.

## Verification commands

```bash
corepack yarn typecheck
corepack yarn test
```

`yarn test` runs the named tests in one process so PGlite SQL tests are actually reported, including their subtests. The SQL harness executes the real schema, migrations, grants, RLS, triggers and functions. It supplies synthetic `auth.users`/`auth.uid()`/API roles, substitutes UUID generation, and skips the unused native PostGIS extension. It is not a replacement for hosted Auth, Storage, Realtime, migration, or device tests.

The test command includes `--no-wasm-code-gc` as a temporary workaround for the [Node 24/V8 WebAssembly code-collection crash](https://github.com/nodejs/node/issues/66366) encountered when repeatedly creating and closing PGlite fixtures. It applies only to this short-lived test process, keeps all assertions enabled, and may retain compiled WebAssembly code until the process exits. Revisit the flag after adopting a Node release with the upstream fix.

For a local Android/iOS JavaScript and Hermes bundle check:

```bash
corepack yarn expo export --platform android --platform ios --max-workers 2
```

This checks bundling. It does not generate a signed APK/IPA, deploy the app, or validate native permissions, deep links, maps or push delivery on a physical device. Use staging credentials for interactive testing. CI may use an explicitly nonfunctional placeholder URL/key for bundle-only checks.

The [App checks workflow](.github/workflows/ci.yml) runs locked installation, TypeScript, regression tests and both native bundle exports for pull requests to `dev`/`main` and pushes to those branches. It has read-only repository permissions and uses no Supabase credentials or deployment steps.

For dependency advisories:

```bash
corepack yarn audit
```

Registry findings must be triaged by path and actual exposure. Expo/Metro and React Native developer tooling are included in the dependency graph. The [21 October dependency snapshot](docs/dependency-audit-2026-10-21.json) records the bounded `shell-quote` lock update and the 49 remaining distinct advisories. The recovery patch is not a claim of zero vulnerabilities.

## Push webhook setup

The `send-push` function now requires a dedicated **server-side secret** and reads the actual notification row from the database. It rejects attempts to choose a recipient or message through a caller-supplied webhook record.

Before deploying the function:

1. Generate a long random `PUSH_WEBHOOK_SECRET` and save it in the Supabase project's function secrets. Keep it out of the repository and mobile environment.
2. Configure the `public.notifications` database webhook for `INSERT`, posting to `https://your-project.supabase.co/functions/v1/send-push`.
3. Add `Content-Type: application/json` and an `x-webhook-secret` header whose value matches the function secret.
4. Keep the function gateway's authentication enabled and configure the webhook's server-side Authorization header as required by the project. The dedicated secret is an additional check; an ordinary user's JWT is insufficient. Never ship privileged credentials to the app.
5. Deploy the reviewed function using the authenticated Supabase CLI:

```bash
supabase functions deploy send-push
```

Missing secret configuration returns HTTP 503. Incorrect webhook credentials return HTTP 401. An accepted Expo ticket is reported as **queued**, not as confirmed delivery. Receipt processing, durable retries/idempotency and invalid-token cleanup are still to be implemented. The current one-token-per-profile storage also needs a private multi-device design before public release.

Apply the notification permission migration and webhook configuration as one staging rollout. Old clients will lose the ability to write simulated donations or notification contents after migration 12, which is intentional.

## Project map

| Path | Purpose |
| --- | --- |
| `app/(auth)` | Registration, login and specialist onboarding |
| `app/(tabs)` | Feed, map, directory, campaigns, adoption and own profile |
| `app/adoption`, `app/monitoring` | Applications, approval records and follow-up |
| `app/missing`, `app/pets`, `app/alerts` | Pet welfare workflows |
| `app/messages`, `app/profile` | Messaging and account workflows |
| `lib/authState.ts`, `store/authStore.ts` | Isolated session/profile lifecycle and Supabase adapter |
| `store/notificationState.ts` | Notification ownership, unread state and request guards |
| `supabase` | Base schema, ordered migrations, storage and push function |
| `tests` | Auth, authorization, bootstrap, notifications, media and webhook regression checks |
| `docs/AUDIT_2026_10_21.md` | Recovery findings and release acceptance criteria |
| `docs/superpowers` | Original design and implementation plan, retained as history |

## Development conventions

- Treat `auth.users.id` and `profiles.id` as distinct identifiers; use the foreign key expected by each table.
- Check Supabase `error` results. Do not report successful mutations before all required server work succeeds.
- Put ownership and critical state transitions in database authorization/transactions, even when the UI hides a control.
- Add visible strings to both language files.
- Keep financial collection disabled until a server-confirmed payment workflow is designed and tested.
- Use the audit's next milestones to finish existing flows before adding unrelated features.
