-- 2026_04_21_11_vet_messages.sql
-- 1:1 message threads between a pet owner and a vet.

CREATE TABLE IF NOT EXISTS vet_threads (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id              UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vet_id                UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pet_id                UUID REFERENCES pets(id) ON DELETE SET NULL,
  last_message_at       TIMESTAMPTZ DEFAULT NOW(),
  last_message_preview  TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id, vet_id, pet_id)
);

CREATE TABLE IF NOT EXISTS vet_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id   UUID NOT NULL REFERENCES vet_threads(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vet_threads_owner ON vet_threads(owner_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_vet_threads_vet   ON vet_threads(vet_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_vet_messages_thread ON vet_messages(thread_id, created_at DESC);

ALTER TABLE vet_threads  ENABLE ROW LEVEL SECURITY;
ALTER TABLE vet_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "threads_participants_read" ON vet_threads;
CREATE POLICY "threads_participants_read" ON vet_threads FOR SELECT USING (
  owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  OR vet_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "threads_owner_insert" ON vet_threads;
CREATE POLICY "threads_owner_insert" ON vet_threads FOR INSERT WITH CHECK (
  owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "messages_participants_read" ON vet_messages;
CREATE POLICY "messages_participants_read" ON vet_messages FOR SELECT USING (
  thread_id IN (
    SELECT id FROM vet_threads
     WHERE owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR vet_id   IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "messages_participants_insert" ON vet_messages;
CREATE POLICY "messages_participants_insert" ON vet_messages FOR INSERT WITH CHECK (
  sender_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  AND thread_id IN (
    SELECT id FROM vet_threads
     WHERE owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR vet_id   IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
);

-- Mark-read: a participant can flip their counterparty's messages from unread to read.
DROP POLICY IF EXISTS "messages_participants_update" ON vet_messages;
CREATE POLICY "messages_participants_update" ON vet_messages FOR UPDATE USING (
  thread_id IN (
    SELECT id FROM vet_threads
     WHERE owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR vet_id   IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
);

-- On new message: bump thread + notify the other party.
CREATE OR REPLACE FUNCTION trg_vet_message_after_insert() RETURNS TRIGGER AS $$
DECLARE
  recipient_user UUID;
  sender_name TEXT;
  is_vet_sender BOOLEAN;
BEGIN
  UPDATE vet_threads
     SET last_message_at = NEW.created_at,
         last_message_preview = LEFT(NEW.body, 140)
   WHERE id = NEW.thread_id;

  SELECT
    (NEW.sender_id = t.vet_id),
    CASE WHEN NEW.sender_id = t.vet_id
      THEN (SELECT user_id FROM profiles WHERE id = t.owner_id)
      ELSE (SELECT user_id FROM profiles WHERE id = t.vet_id)
    END
  INTO is_vet_sender, recipient_user
  FROM vet_threads t WHERE t.id = NEW.thread_id;

  SELECT name INTO sender_name FROM profiles WHERE id = NEW.sender_id;

  IF recipient_user IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, metadata)
    VALUES (
      recipient_user,
      'vet_message',
      COALESCE(sender_name,'Mensaje nuevo'),
      LEFT(NEW.body, 200),
      jsonb_build_object('thread_id', NEW.thread_id)
    );
  END IF;

  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS vet_messages_after_insert ON vet_messages;
CREATE TRIGGER vet_messages_after_insert
  AFTER INSERT ON vet_messages
  FOR EACH ROW EXECUTE FUNCTION trg_vet_message_after_insert();
