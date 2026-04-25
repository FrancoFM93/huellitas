-- 2026_04_21_08_adoption_notifications.sql
-- In-app notifications for adoption pipeline events.

CREATE OR REPLACE FUNCTION trg_notify_new_application() RETURNS TRIGGER AS $$
DECLARE
  poster_user UUID;
  applicant_name TEXT;
  pet_name TEXT;
BEGIN
  SELECT pr.user_id INTO poster_user
    FROM adoption_posts ap
    JOIN profiles pr ON pr.id = ap.poster_id
   WHERE ap.id = NEW.post_id;
  SELECT name INTO pet_name FROM adoption_posts WHERE id = NEW.post_id;
  SELECT name INTO applicant_name FROM profiles WHERE id = NEW.applicant_id;

  IF poster_user IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, metadata)
    VALUES (
      poster_user,
      'adoption_application',
      'Nueva solicitud de adopción',
      COALESCE(applicant_name,'Alguien') || ' quiere adoptar a ' || COALESCE(pet_name,'tu mascota'),
      jsonb_build_object('post_id', NEW.post_id, 'application_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS adoption_apps_notify_new ON adoption_applications;
CREATE TRIGGER adoption_apps_notify_new
  AFTER INSERT ON adoption_applications
  FOR EACH ROW EXECUTE FUNCTION trg_notify_new_application();

CREATE OR REPLACE FUNCTION trg_notify_application_decision() RETURNS TRIGGER AS $$
DECLARE
  applicant_user UUID;
  pet_name TEXT;
  title TEXT;
  body TEXT;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('approved','rejected') THEN RETURN NEW; END IF;

  SELECT user_id INTO applicant_user FROM profiles WHERE id = NEW.applicant_id;
  SELECT name INTO pet_name FROM adoption_posts WHERE id = NEW.post_id;

  IF NEW.status = 'approved' THEN
    title := '¡Solicitud aprobada! 🎉';
    body  := 'Tu solicitud para adoptar a ' || COALESCE(pet_name,'la mascota') || ' fue aprobada.';
  ELSE
    title := 'Solicitud no aceptada';
    body  := 'Tu solicitud para ' || COALESCE(pet_name,'la mascota') || ' no fue aceptada esta vez.';
  END IF;

  IF applicant_user IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, metadata)
    VALUES (
      applicant_user,
      'adoption_decision',
      title,
      body,
      jsonb_build_object('post_id', NEW.post_id, 'application_id', NEW.id, 'status', NEW.status)
    );
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS adoption_apps_notify_decision ON adoption_applications;
CREATE TRIGGER adoption_apps_notify_decision
  AFTER UPDATE OF status ON adoption_applications
  FOR EACH ROW EXECUTE FUNCTION trg_notify_application_decision();

CREATE OR REPLACE FUNCTION trg_notify_session_ready() RETURNS TRIGGER AS $$
DECLARE
  poster_user UUID;
  pet_name TEXT;
  was_ready BOOLEAN;
  is_ready  BOOLEAN;
BEGIN
  was_ready := COALESCE(array_length(OLD.photo_urls,1),0) > 0 OR OLD.jitsi_room IS NOT NULL;
  is_ready  := COALESCE(array_length(NEW.photo_urls,1),0) > 0 OR NEW.jitsi_room IS NOT NULL;
  IF was_ready OR NOT is_ready OR NEW.status <> 'scheduled' THEN RETURN NEW; END IF;

  SELECT pr.user_id, ap.name INTO poster_user, pet_name
    FROM adoption_contracts c
    JOIN profiles pr ON pr.id = c.poster_id
    JOIN adoption_posts ap ON ap.id = c.post_id
   WHERE c.id = NEW.contract_id;

  IF poster_user IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, metadata)
    VALUES (
      poster_user,
      'monitoring_ready',
      'Sesión lista para verificar',
      'El adoptante de ' || COALESCE(pet_name,'la mascota') || ' cargó contenido para revisar.',
      jsonb_build_object('session_id', NEW.id, 'contract_id', NEW.contract_id)
    );
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS monitoring_notify_ready ON monitoring_sessions;
CREATE TRIGGER monitoring_notify_ready
  AFTER UPDATE OF photo_urls, jitsi_room ON monitoring_sessions
  FOR EACH ROW EXECUTE FUNCTION trg_notify_session_ready();

CREATE OR REPLACE FUNCTION trg_notify_session_verified() RETURNS TRIGGER AS $$
DECLARE
  adopter_user UUID;
  pet_name TEXT;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN RETURN NEW; END IF;

  SELECT pr.user_id, ap.name INTO adopter_user, pet_name
    FROM adoption_contracts c
    JOIN profiles pr ON pr.id = c.adopter_id
    JOIN adoption_posts ap ON ap.id = c.post_id
   WHERE c.id = NEW.contract_id;

  IF adopter_user IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, metadata)
    VALUES (
      adopter_user,
      'monitoring_verified',
      'Sesión verificada ✅',
      'Una sesión de seguimiento de ' || COALESCE(pet_name,'tu mascota') || ' fue verificada.',
      jsonb_build_object('session_id', NEW.id, 'contract_id', NEW.contract_id)
    );
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS monitoring_notify_verified ON monitoring_sessions;
CREATE TRIGGER monitoring_notify_verified
  AFTER UPDATE OF status ON monitoring_sessions
  FOR EACH ROW EXECUTE FUNCTION trg_notify_session_verified();

-- Housekeeping: flip past-due scheduled sessions to "missed".
-- Call from a pg_cron job, an Edge Function, or simply on poster panel load.
CREATE OR REPLACE FUNCTION fn_mark_missed_sessions() RETURNS INTEGER AS $$
DECLARE n INTEGER;
BEGIN
  UPDATE monitoring_sessions
     SET status = 'missed'
   WHERE status = 'scheduled'
     AND scheduled_at < NOW() - INTERVAL '7 days'
     AND COALESCE(array_length(photo_urls,1),0) = 0
     AND jitsi_room IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;
