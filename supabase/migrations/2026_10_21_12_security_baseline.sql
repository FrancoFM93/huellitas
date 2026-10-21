-- Security baseline for the existing schema. Apply after migrations 01 through 11.
-- This migration changes permissions only; it does not remove application data.
-- Service-side payment confirmation is not implemented. Client donation writes
-- and balance RPCs are deliberately disabled until that workflow exists.

BEGIN;

-- SECURITY DEFINER routines use this trusted schema, with temporary objects last.
-- App roles must not be able to create replacement objects in that schema.
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;

-- Owners can edit their profile, but cannot grant themselves an admin/verified
-- role, change their identity/account type, or reverse the deletion marker.
REVOKE INSERT, UPDATE ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT INSERT (user_id, type, name, avatar_url, bio, phone, location,
              country, region, city_slug)
  ON public.profiles TO authenticated;
GRANT UPDATE (name, avatar_url, bio, phone, location,
              country, region, city_slug, push_token)
  ON public.profiles TO authenticated;

DROP POLICY IF EXISTS profiles_own_insert ON public.profiles;
CREATE POLICY profiles_own_insert ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND role = 'user'
              AND verified = FALSE AND deleted_at IS NULL);

DROP POLICY IF EXISTS profiles_own_update ON public.profiles;
CREATE POLICY profiles_own_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (user_id = auth.uid() AND deleted_at IS NULL);

-- This queue is private operational data. Only the definer RPC and backend
-- workers may insert or process it. No client policy is intentionally provided.
ALTER TABLE public.account_deletion_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_deletion_queue FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.account_deletion_queue TO service_role;

-- Attribute public content to the signed-in, active profile on the server.
DROP POLICY IF EXISTS missing_reports_auth_insert ON public.missing_pet_reports;
CREATE POLICY missing_reports_auth_insert ON public.missing_pet_reports
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.pets pet ON pet.owner_id = p.id
      WHERE p.id = reporter_id AND p.user_id = auth.uid()
        AND p.deleted_at IS NULL AND pet.id = pet_id
    )
  );

DROP POLICY IF EXISTS missing_reports_own_update ON public.missing_pet_reports;
CREATE POLICY missing_reports_own_update ON public.missing_pet_reports
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = reporter_id AND p.user_id = auth.uid() AND p.deleted_at IS NULL
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.pets pet ON pet.owner_id = p.id
      WHERE p.id = reporter_id AND p.user_id = auth.uid()
        AND p.deleted_at IS NULL AND pet.id = pet_id
    )
  );

DROP POLICY IF EXISTS sightings_auth_insert ON public.pet_sightings;
CREATE POLICY sightings_auth_insert ON public.pet_sightings
  FOR INSERT TO authenticated WITH CHECK (
    reporter_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS alerts_auth_insert ON public.community_alerts;
CREATE POLICY alerts_auth_insert ON public.community_alerts
  FOR INSERT TO authenticated WITH CHECK (
    creator_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS responses_auth_insert ON public.alert_responses;
CREATE POLICY responses_auth_insert ON public.alert_responses
  FOR INSERT TO authenticated WITH CHECK (
    responder_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
    AND status = 'offered'
  );

DROP POLICY IF EXISTS fundraisers_auth_insert ON public.fundraisers;
CREATE POLICY fundraisers_auth_insert ON public.fundraisers
  FOR INSERT TO authenticated WITH CHECK (
    creator_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
    AND current_amount = 0 AND target_amount > 0
  );

DROP POLICY IF EXISTS adoptions_auth_insert ON public.adoption_posts;
CREATE POLICY adoptions_auth_insert ON public.adoption_posts
  FOR INSERT TO authenticated WITH CHECK (
    poster_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS eb_admin_or_verified_org_insert ON public.emergency_broadcasts;
CREATE POLICY eb_admin_or_verified_org_insert ON public.emergency_broadcasts
  FOR INSERT TO authenticated WITH CHECK (
    creator_id IN (
      SELECT id FROM public.profiles
      WHERE user_id = auth.uid() AND deleted_at IS NULL
        AND (role = 'admin' OR (type = 'fundacion' AND verified = TRUE))
    )
  );

-- A successful insert is not proof of payment. These tables and routines must
-- only be written by a future trusted payment workflow, never the mobile app.
DROP POLICY IF EXISTS donations_auth_insert ON public.donations;
REVOKE INSERT, UPDATE, DELETE ON public.donations, public.emergency_fund
  FROM PUBLIC, anon, authenticated;
REVOKE UPDATE ON public.fundraisers FROM PUBLIC, anon, authenticated;
GRANT UPDATE (title, description, beneficiary_type, target_amount, cover_photo, status)
  ON public.fundraisers TO authenticated;

-- Applications begin pending; applicants may only withdraw their pending row.
-- In particular, they cannot reassign it or manufacture an approval timestamp.
REVOKE INSERT, UPDATE ON public.adoption_applications FROM PUBLIC, anon, authenticated;
GRANT INSERT (post_id, applicant_id, message, contact_phone)
  ON public.adoption_applications TO authenticated;
GRANT UPDATE (status) ON public.adoption_applications TO authenticated;

DROP POLICY IF EXISTS apps_insert ON public.adoption_applications;
CREATE POLICY apps_insert ON public.adoption_applications
  FOR INSERT TO authenticated WITH CHECK (
    status = 'pending' AND decided_at IS NULL
    AND applicant_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM public.adoption_posts ap
      WHERE ap.id = post_id AND ap.status = 'available' AND ap.poster_id <> applicant_id
    )
  );

DROP POLICY IF EXISTS apps_withdraw ON public.adoption_applications;
CREATE POLICY apps_withdraw ON public.adoption_applications
  FOR UPDATE TO authenticated USING (
    status = 'pending' AND applicant_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  ) WITH CHECK (
    status = 'withdrawn' AND applicant_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
  );

-- Adopters submit evidence. Only the poster's verification RPC may mark a
-- session completed, set verifier identity, or alter its scheduled date.
REVOKE UPDATE ON public.monitoring_sessions FROM PUBLIC, anon, authenticated;
GRANT UPDATE (photo_urls, jitsi_room) ON public.monitoring_sessions TO authenticated;
DROP POLICY IF EXISTS sessions_adopter_update ON public.monitoring_sessions;
CREATE POLICY sessions_adopter_update ON public.monitoring_sessions
  FOR UPDATE TO authenticated USING (
    status = 'scheduled' AND contract_id IN (
      SELECT c.id FROM public.adoption_contracts c
      JOIN public.profiles p ON p.id = c.adopter_id
      WHERE p.user_id = auth.uid() AND p.deleted_at IS NULL AND c.status = 'active'
    )
  ) WITH CHECK (
    status = 'scheduled' AND contract_id IN (
      SELECT c.id FROM public.adoption_contracts c
      JOIN public.profiles p ON p.id = c.adopter_id
      WHERE p.user_id = auth.uid() AND p.deleted_at IS NULL AND c.status = 'active'
    )
  );

-- A message's author, content and thread are immutable to app clients. A
-- participant may mark only a message received from their counterparty as read.
REVOKE UPDATE ON public.vet_messages FROM PUBLIC, anon, authenticated;
GRANT UPDATE (read_at) ON public.vet_messages TO authenticated;
DROP POLICY IF EXISTS messages_participants_update ON public.vet_messages;
CREATE POLICY messages_participants_update ON public.vet_messages
  FOR UPDATE TO authenticated USING (
    sender_id NOT IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    AND thread_id IN (
      SELECT t.id FROM public.vet_threads t JOIN public.profiles p
        ON p.id = t.owner_id OR p.id = t.vet_id
      WHERE p.user_id = auth.uid() AND p.deleted_at IS NULL
    )
  ) WITH CHECK (
    sender_id NOT IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    AND thread_id IN (
      SELECT t.id FROM public.vet_threads t JOIN public.profiles p
        ON p.id = t.owner_id OR p.id = t.vet_id
      WHERE p.user_id = auth.uid() AND p.deleted_at IS NULL
    )
  );

-- Notifications are produced by trusted triggers. Recipients may only read
-- them and change their own read flag, not forge titles, metadata or recipients.
DROP POLICY IF EXISTS notifications_own ON public.notifications;
CREATE POLICY notifications_own_read ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY notifications_own_update ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
REVOKE INSERT, UPDATE, DELETE ON public.notifications FROM PUBLIC, anon, authenticated;
GRANT UPDATE (read) ON public.notifications TO authenticated;

-- Pin the lookup path of the existing definer routines and explicitly choose
-- who may call them. Trigger functions do not need direct client execution.
ALTER FUNCTION public.increment_emergency_fund(NUMERIC) SET search_path = public, pg_temp;
ALTER FUNCTION public.increment_fundraiser(UUID, NUMERIC) SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_vets_on_alert() SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_owner_on_sighting() SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_alert_fanout() SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_broadcast_fanout() SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_approve_application(UUID) SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_verify_session(UUID, TEXT) SET search_path = public, pg_temp;
ALTER FUNCTION public.trg_notify_new_application() SET search_path = public, pg_temp;
ALTER FUNCTION public.trg_notify_application_decision() SET search_path = public, pg_temp;
ALTER FUNCTION public.trg_notify_session_ready() SET search_path = public, pg_temp;
ALTER FUNCTION public.trg_notify_session_verified() SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_mark_missed_sessions() SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_request_account_deletion() SET search_path = public, pg_temp;
ALTER FUNCTION public.trg_vet_message_after_insert() SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION
  public.increment_emergency_fund(NUMERIC),
  public.increment_fundraiser(UUID, NUMERIC),
  public.notify_vets_on_alert(),
  public.notify_owner_on_sighting(),
  public.fn_alert_fanout(),
  public.fn_broadcast_fanout(),
  public.fn_approve_application(UUID),
  public.fn_verify_session(UUID, TEXT),
  public.trg_notify_new_application(),
  public.trg_notify_application_decision(),
  public.trg_notify_session_ready(),
  public.trg_notify_session_verified(),
  public.fn_mark_missed_sessions(),
  public.fn_request_account_deletion(),
  public.trg_vet_message_after_insert()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.fn_approve_application(UUID),
  public.fn_verify_session(UUID, TEXT),
  public.fn_mark_missed_sessions(),
  public.fn_request_account_deletion()
  TO authenticated;

GRANT EXECUTE ON FUNCTION
  public.increment_emergency_fund(NUMERIC),
  public.increment_fundraiser(UUID, NUMERIC),
  public.fn_mark_missed_sessions()
  TO service_role;

COMMIT;
