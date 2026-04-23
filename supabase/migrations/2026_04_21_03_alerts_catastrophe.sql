-- 2026_04_21_03_alerts_catastrophe.sql
-- Adds geo columns + catastrophe category/subtype to community_alerts.
-- Creates fanout trigger: notify fundacion profiles in same city;
-- widen to country on severity=5 OR catastrophe.

ALTER TABLE community_alerts
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS city_slug TEXT,
  ADD COLUMN IF NOT EXISTS catastrophe_subtype TEXT
    CHECK (catastrophe_subtype IN ('earthquake','flood','fire','other'));

ALTER TABLE community_alerts DROP CONSTRAINT IF EXISTS community_alerts_category_check;
ALTER TABLE community_alerts ADD CONSTRAINT community_alerts_category_check
  CHECK (category IN ('injured','abandoned','abuse','stray','emergency','other','catastrophe'));

CREATE INDEX IF NOT EXISTS idx_community_alerts_country_city
  ON community_alerts(country, city_slug);

-- Fanout: notify fundacion profiles. Inserts into notifications(user_id, metadata).
CREATE OR REPLACE FUNCTION fn_alert_fanout() RETURNS TRIGGER AS $$
DECLARE
  target_user UUID;
  is_wide BOOLEAN := (NEW.severity = 5 OR NEW.category = 'catastrophe');
BEGIN
  IF NEW.country IS NULL THEN RETURN NEW; END IF;

  FOR target_user IN
    SELECT p.user_id FROM profiles p
    WHERE p.type = 'fundacion'
      AND p.country = NEW.country
      AND (is_wide OR p.city_slug = NEW.city_slug)
  LOOP
    INSERT INTO notifications (user_id, type, title, body, metadata)
    VALUES (
      target_user,
      'alert',
      COALESCE(NEW.title, 'Nueva alerta'),
      COALESCE(NEW.description, ''),
      jsonb_build_object(
        'alert_id', NEW.id,
        'wide', is_wide,
        'severity', NEW.severity,
        'category', NEW.category,
        'catastrophe_subtype', NEW.catastrophe_subtype
      )
    );
  END LOOP;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_alert_fanout ON community_alerts;
CREATE TRIGGER trg_alert_fanout AFTER INSERT ON community_alerts
  FOR EACH ROW EXECUTE FUNCTION fn_alert_fanout();
