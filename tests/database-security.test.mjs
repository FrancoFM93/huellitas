import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createTestDatabase, asUser } from './helpers/database.mjs'

async function createProfile(db, name, type = 'user') {
  const userId = randomUUID()
  await db.query(
    'INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3)',
    [userId, `${userId}@example.test`, JSON.stringify({ name, type })],
  )
  // Works both before and after the profile provisioning migration: if its
  // auth.users trigger has already inserted the profile, retain that identity.
  const { rows } = await db.query(`
    INSERT INTO public.profiles (user_id, type, name, country, city_slug)
    VALUES ($1, $2, $3, 'CL', 'curico')
    ON CONFLICT (user_id) DO UPDATE SET type = EXCLUDED.type, name = EXCLUDED.name,
      country = EXCLUDED.country, city_slug = EXCLUDED.city_slug
    RETURNING *
  `, [userId, type, name])
  return rows[0]
}

const denied = promise => assert.rejects(promise, error => error.code === '42501')

test('database authorization with real PostgreSQL policies, grants and triggers', async t => {
  const db = await createTestDatabase()
  t.after(() => db.close())
  const owner = await createProfile(db, 'Pet owner')
  const adopter = await createProfile(db, 'Adopter')
  const outsider = await createProfile(db, 'Unrelated user')
  const vet = await createProfile(db, 'Veterinarian', 'vet')
  const petId = randomUUID()
  const otherPetId = randomUUID()
  const postId = randomUUID()
  const alertId = randomUUID()
  const fundraiserId = randomUUID()
  await db.query(`INSERT INTO public.pets (id, owner_id, name, species, color)
    VALUES ($1, $2, 'Moka', 'dog', 'brown'), ($3, $4, 'Luna', 'cat', 'white')`,
  [petId, owner.id, otherPetId, outsider.id])
  await db.query(`INSERT INTO public.adoption_posts
    (id, poster_id, name, species, age_range, description, location, contact_info)
    VALUES ($1, $2, 'Moka', 'dog', 'adult', 'Synthetic test pet', 'Curico', 'test contact')`,
  [postId, owner.id])
  await db.query(`INSERT INTO public.community_alerts
    (id, creator_id, title, description, category, severity, address)
    VALUES ($1, $2, 'Test alert', 'Synthetic data', 'stray', 1, 'Curico')`, [alertId, owner.id])
  await db.query(`INSERT INTO public.fundraisers
    (id, creator_id, title, description, beneficiary_type, target_amount)
    VALUES ($1, $2, 'Test campaign', 'Synthetic data', 'animal', 100)`, [fundraiserId, owner.id])

  await t.test('profile edits work without allowing privilege or identity changes', async () => {
    await asUser(db, owner.user_id, tx => tx.query(
      'UPDATE public.profiles SET name = $1, push_token = $2 WHERE id = $3',
      ['Updated owner', 'ExponentPushToken[synthetic-test]', owner.id],
    ))
    for (const sql of [
      "UPDATE public.profiles SET role = 'admin' WHERE id = $1",
      'UPDATE public.profiles SET verified = TRUE WHERE id = $1',
      "UPDATE public.profiles SET type = 'fundacion' WHERE id = $1",
      'UPDATE public.profiles SET user_id = gen_random_uuid() WHERE id = $1',
      'UPDATE public.profiles SET id = gen_random_uuid() WHERE id = $1',
      'UPDATE public.profiles SET deleted_at = NULL WHERE id = $1',
    ]) {
      await denied(asUser(db, owner.user_id, tx => tx.query(sql, [owner.id])))
    }
    await denied(asUser(db, owner.user_id, tx => tx.query(`
      INSERT INTO public.profiles (user_id, type, name, role, verified)
      VALUES ($1, 'user', 'Forged admin', 'admin', TRUE)
    `, [owner.user_id])))
    const { rows } = await db.query('SELECT name, role, verified FROM public.profiles WHERE id = $1', [owner.id])
    assert.deepEqual(rows[0], { name: 'Updated owner', role: 'user', verified: false })
  })

  await t.test('public content cannot impersonate another profile', async () => {
    const inserts = [
      [`INSERT INTO public.community_alerts
        (creator_id, title, description, category, severity, address)
        VALUES ($1, 'Test', 'Test', 'stray', 1, 'Curico')`, [owner.id]],
      [`INSERT INTO public.alert_responses (alert_id, responder_id, message)
        VALUES ($1, $2, 'Forged reply')`, [alertId, owner.id]],
      [`INSERT INTO public.fundraisers (creator_id, title, description, beneficiary_type, target_amount)
        VALUES ($1, 'Test', 'Test', 'animal', 100)`, [owner.id]],
      [`INSERT INTO public.adoption_posts
        (poster_id, name, species, age_range, description, location, contact_info)
        VALUES ($1, 'Test', 'dog', 'adult', 'Test', 'Curico', 'Test')`, [owner.id]],
    ]
    for (const [sql, params] of inserts) {
      await denied(asUser(db, outsider.user_id, tx => tx.query(sql, params)))
      const result = await asUser(db, owner.user_id, tx => tx.query(sql, params))
      assert.equal(result.affectedRows, 1)
    }
    // The alert trigger still inserts notifications as its trusted owner after
    // direct client EXECUTE/INSERT permissions have been revoked.
    await asUser(db, owner.user_id, tx => tx.query(`INSERT INTO public.community_alerts
      (creator_id, title, description, category, severity, address)
      VALUES ($1, 'Urgent test', 'Test', 'injured', 3, 'Curico')`, [owner.id]))
    const { rows } = await asUser(db, vet.user_id, tx => tx.query(
      "SELECT id FROM public.notifications WHERE type = 'community_alert'",
    ))
    assert.equal(rows.length, 1)
  })

  let reportId
  await t.test('missing reports require an owned pet and sightings require the real reporter', async () => {
    const insertReport = (userId, reporterId, reportedPetId) => asUser(db, userId, tx => tx.query(`
      INSERT INTO public.missing_pet_reports
        (pet_id, reporter_id, last_seen_address, last_seen_at, description)
      VALUES ($1, $2, 'Curico', NOW(), 'Synthetic missing report') RETURNING id
    `, [reportedPetId, reporterId]))
    await denied(insertReport(outsider.user_id, owner.id, petId))
    await denied(insertReport(outsider.user_id, outsider.id, petId))
    const created = await insertReport(owner.user_id, owner.id, petId)
    reportId = created.rows[0].id
    await denied(asUser(db, owner.user_id, tx => tx.query(
      'UPDATE public.missing_pet_reports SET pet_id = $1 WHERE id = $2', [otherPetId, reportId],
    )))
    await denied(asUser(db, outsider.user_id, tx => tx.query(`
      INSERT INTO public.pet_sightings (report_id, reporter_id, address)
      VALUES ($1, $2, 'Curico')
    `, [reportId, owner.id])))
    const sighting = await asUser(db, outsider.user_id, tx => tx.query(`
      INSERT INTO public.pet_sightings (report_id, reporter_id, address)
      VALUES ($1, $2, 'Curico') RETURNING id
    `, [reportId, outsider.id]))
    assert.equal(sighting.rows.length, 1)
    const notices = await asUser(db, owner.user_id, tx => tx.query(
      "SELECT id FROM public.notifications WHERE type = 'pet_sighting'",
    ))
    assert.equal(notices.rows.length, 1)
  })

  await t.test('clients cannot record unverified payments or change money totals', async () => {
    for (const role of ['anon', 'authenticated']) {
      await denied(asUser(db, owner.user_id, tx => tx.query(`
        INSERT INTO public.donations (donor_id, fundraiser_id, amount) VALUES ($1, $2, 50)
      `, [owner.id, fundraiserId]), role))
      await denied(asUser(db, owner.user_id, tx => tx.query(
        'SELECT public.increment_emergency_fund(50)',
      ), role))
      await denied(asUser(db, owner.user_id, tx => tx.query(
        'SELECT public.increment_fundraiser($1, -50)', [fundraiserId],
      ), role))
    }
    await denied(asUser(db, owner.user_id, tx => tx.query(
      'UPDATE public.fundraisers SET current_amount = 9000 WHERE id = $1', [fundraiserId],
    )))
    await denied(asUser(db, owner.user_id, tx => tx.query(`
      INSERT INTO public.fundraisers
        (creator_id, title, description, beneficiary_type, target_amount, current_amount)
      VALUES ($1, 'Fake total', 'Test', 'animal', 100, 90)
    `, [owner.id])))
    await asUser(db, owner.user_id, tx => tx.query(
      "UPDATE public.fundraisers SET title = 'Updated campaign' WHERE id = $1", [fundraiserId],
    ))
    const { rows } = await db.query('SELECT current_amount FROM public.fundraisers WHERE id = $1', [fundraiserId])
    assert.equal(Number(rows[0].current_amount), 0)
    const donations = await db.query('SELECT count(*) AS total FROM public.donations')
    assert.equal(Number(donations.rows[0].total), 0)
  })

  await t.test('notifications are readable and markable only by their recipient, never forgeable', async () => {
    const notification = (await db.query(`
      INSERT INTO public.notifications (user_id, type, title, body)
      VALUES ($1, 'test', 'Test', 'Synthetic notification') RETURNING id
    `, [owner.user_id])).rows[0].id
    await denied(asUser(db, owner.user_id, tx => tx.query(`
      INSERT INTO public.notifications (user_id, type, title, body)
      VALUES ($1, 'broadcast', 'Forged official message', 'Test')
    `, [owner.user_id])))
    await denied(asUser(db, owner.user_id, tx => tx.query(
      "UPDATE public.notifications SET metadata = '{\"thread_id\":\"fake\"}' WHERE id = $1", [notification],
    )))
    await denied(asUser(db, owner.user_id, tx => tx.query(
      'DELETE FROM public.notifications WHERE id = $1', [notification],
    )))
    const hidden = await asUser(db, outsider.user_id, tx => tx.query(
      'SELECT * FROM public.notifications WHERE id = $1', [notification],
    ))
    assert.equal(hidden.rows.length, 0)
    const unchanged = await asUser(db, outsider.user_id, tx => tx.query(
      'UPDATE public.notifications SET read = TRUE WHERE id = $1', [notification],
    ))
    assert.equal(unchanged.affectedRows, 0)
    const changed = await asUser(db, owner.user_id, tx => tx.query(
      'UPDATE public.notifications SET read = TRUE WHERE id = $1 RETURNING read', [notification],
    ))
    assert.equal(changed.rows[0].read, true)
  })

  let applicationId
  await t.test('applicants cannot self-approve or reassign applications; withdrawal still works', async () => {
    const apply = user => asUser(db, user.user_id, tx => tx.query(`
      INSERT INTO public.adoption_applications (post_id, applicant_id, message)
      VALUES ($1, $2, 'Synthetic application') RETURNING id, status
    `, [postId, user.id]))
    await denied(apply(owner))
    await denied(asUser(db, adopter.user_id, tx => tx.query(`
      INSERT INTO public.adoption_applications (post_id, applicant_id, status)
      VALUES ($1, $2, 'approved')
    `, [postId, adopter.id])))
    const created = (await apply(adopter)).rows[0]
    assert.equal(created.status, 'pending')
    await denied(asUser(db, adopter.user_id, tx => tx.query(
      "UPDATE public.adoption_applications SET status = 'approved' WHERE id = $1", [created.id],
    )))
    await denied(asUser(db, adopter.user_id, tx => tx.query(`
      UPDATE public.adoption_applications SET status = 'withdrawn', applicant_id = $1 WHERE id = $2
    `, [outsider.id, created.id])))
    const withdrawn = await asUser(db, adopter.user_id, tx => tx.query(
      "UPDATE public.adoption_applications SET status = 'withdrawn' WHERE id = $1 RETURNING status", [created.id],
    ))
    assert.equal(withdrawn.rows[0].status, 'withdrawn')
    applicationId = (await apply(adopter)).rows[0].id
  })

  await t.test('poster approval and monitoring work, but adopters cannot forge verification', async () => {
    await assert.rejects(asUser(db, adopter.user_id, tx => tx.query(
      'SELECT public.fn_approve_application($1)', [applicationId],
    )), /not allowed/)
    const approved = await asUser(db, owner.user_id, tx => tx.query(
      'SELECT public.fn_approve_application($1) AS id', [applicationId],
    ))
    const contractId = approved.rows[0].id
    const sessions = await asUser(db, adopter.user_id, tx => tx.query(
      'SELECT * FROM public.monitoring_sessions WHERE contract_id = $1 ORDER BY scheduled_at', [contractId],
    ))
    assert.equal(sessions.rows.length, 4)
    const sessionId = sessions.rows[0].id
    await asUser(db, adopter.user_id, tx => tx.query(
      'UPDATE public.monitoring_sessions SET photo_urls = $1 WHERE id = $2',
      [['https://example.test/synthetic-photo.jpg'], sessionId],
    ))
    for (const sql of [
      "UPDATE public.monitoring_sessions SET status = 'completed' WHERE id = $1",
      'UPDATE public.monitoring_sessions SET verified_at = NOW() WHERE id = $1',
      'UPDATE public.monitoring_sessions SET verifier_id = gen_random_uuid() WHERE id = $1',
      'UPDATE public.monitoring_sessions SET contract_id = gen_random_uuid() WHERE id = $1',
      "UPDATE public.monitoring_sessions SET scheduled_at = NOW() + INTERVAL '10 years' WHERE id = $1",
    ]) {
      await denied(asUser(db, adopter.user_id, tx => tx.query(sql, [sessionId])))
    }
    await assert.rejects(asUser(db, adopter.user_id, tx => tx.query(
      'SELECT public.fn_verify_session($1)', [sessionId],
    )), /only poster can verify/)
    await asUser(db, owner.user_id, tx => tx.query(
      'SELECT public.fn_verify_session($1, $2)', [sessionId, 'Reviewed synthetic evidence'],
    ))
    const verified = await asUser(db, adopter.user_id, tx => tx.query(
      'SELECT status, verifier_id FROM public.monitoring_sessions WHERE id = $1', [sessionId],
    ))
    assert.deepEqual(verified.rows[0], { status: 'completed', verifier_id: owner.id })
    const immutable = await asUser(db, adopter.user_id, tx => tx.query(
      "UPDATE public.monitoring_sessions SET photo_urls = '{}' WHERE id = $1", [sessionId],
    ))
    assert.equal(immutable.affectedRows, 0)
  })

  await t.test('message recipients can mark read but cannot rewrite their counterparty', async () => {
    const thread = (await asUser(db, owner.user_id, tx => tx.query(`
      INSERT INTO public.vet_threads (owner_id, vet_id, pet_id) VALUES ($1, $2, $3) RETURNING id
    `, [owner.id, vet.id, petId]))).rows[0].id
    const message = (await asUser(db, vet.user_id, tx => tx.query(`
      INSERT INTO public.vet_messages (thread_id, sender_id, body) VALUES ($1, $2, $3) RETURNING id
    `, [thread, vet.id, 'Original veterinary message']))).rows[0].id
    await denied(asUser(db, owner.user_id, tx => tx.query(
      "UPDATE public.vet_messages SET body = 'Falsified instructions' WHERE id = $1", [message],
    )))
    await denied(asUser(db, owner.user_id, tx => tx.query(
      'UPDATE public.vet_messages SET sender_id = $1 WHERE id = $2', [owner.id, message],
    )))
    const ownReceipt = await asUser(db, vet.user_id, tx => tx.query(
      'UPDATE public.vet_messages SET read_at = NOW() WHERE id = $1', [message],
    ))
    assert.equal(ownReceipt.affectedRows, 0)
    const receipt = await asUser(db, owner.user_id, tx => tx.query(
      'UPDATE public.vet_messages SET read_at = NOW() WHERE id = $1 RETURNING body, read_at', [message],
    ))
    assert.equal(receipt.rows[0].body, 'Original veterinary message')
    assert.ok(receipt.rows[0].read_at)
    const hidden = await asUser(db, outsider.user_id, tx => tx.query(
      'SELECT * FROM public.vet_messages WHERE thread_id = $1', [thread],
    ))
    assert.equal(hidden.rows.length, 0)
  })

  await t.test('deletion requests reach a private queue and clients cannot restore deleted profiles', async () => {
    const deleted = await createProfile(db, 'Deletion test')
    for (const role of ['anon', 'authenticated']) {
      await denied(asUser(db, outsider.user_id, tx => tx.query(
        'SELECT * FROM public.account_deletion_queue',
      ), role))
      await denied(asUser(db, outsider.user_id, tx => tx.query(
        'INSERT INTO public.account_deletion_queue (user_id) VALUES ($1)', [deleted.user_id],
      ), role))
    }
    await denied(asUser(db, null, tx => tx.query('SELECT public.fn_request_account_deletion()'), 'anon'))
    await asUser(db, deleted.user_id, tx => tx.query('SELECT public.fn_request_account_deletion()'))
    const profile = (await db.query('SELECT * FROM public.profiles WHERE id = $1', [deleted.id])).rows[0]
    assert.ok(profile.deleted_at)
    assert.equal(profile.name, 'Cuenta eliminada')
    assert.equal(profile.push_token, null)
    const queue = await db.query('SELECT user_id FROM public.account_deletion_queue WHERE user_id = $1', [deleted.user_id])
    assert.equal(queue.rows.length, 1)
    await denied(asUser(db, deleted.user_id, tx => tx.query(
      'UPDATE public.profiles SET deleted_at = NULL WHERE id = $1', [deleted.id],
    )))
    const edit = await asUser(db, deleted.user_id, tx => tx.query(
      "UPDATE public.profiles SET name = 'Restored name' WHERE id = $1", [deleted.id],
    ))
    assert.equal(edit.affectedRows, 0)
  })

  await t.test('definer routines have trusted lookup paths and no anonymous execution grant', async () => {
    const { rows } = await db.query(`
      SELECT p.proname, p.proconfig,
        has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prosecdef
    `)
    assert.ok(rows.length >= 15)
    for (const row of rows) {
      assert.ok(row.proconfig?.some(value => value.startsWith('search_path=')), row.proname)
      assert.equal(row.anon_execute, false, row.proname)
    }
  })
})
